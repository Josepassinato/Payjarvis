"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useTranslation } from "react-i18next";
import { submitOnboardingStep, getOnboardingStatus, ocrDocument } from "@/lib/api";
import { OnboardingProgress } from "@/components/onboarding-progress";

const COUNTRIES = [
  { code: "BR", label: "Brazil" },
  { code: "US", label: "United States" },
  { code: "PT", label: "Portugal" },
  { code: "ES", label: "Spain" },
  { code: "MX", label: "Mexico" },
  { code: "AR", label: "Argentina" },
  { code: "CO", label: "Colombia" },
  { code: "CL", label: "Chile" },
  { code: "GB", label: "United Kingdom" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "OTHER", label: "Other" },
];

export default function OnboardingStep1() {
  const { t } = useTranslation();
  const { getToken } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [country, setCountry] = useState("BR");
  const [address, setAddress] = useState({ street: "", number: "", city: "", state: "", zip: "", country: "BR" });

  const [cameraActive, setCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrDone, setOcrDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [ocrMissedFields, setOcrMissedFields] = useState<string[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if already completed
  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const status = await getOnboardingStatus(token);
        if (status.onboardingStep >= 5) {
          router.replace("/dashboard");
        }
      } catch {
        // continue
      }
    })();
  }, [getToken, router]);

  const startCamera = useCallback(async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        // Fallback: some iOS devices reject environment constraint
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      setCameraActive(true);
      setCameraError(false);
    } catch {
      setCameraError(true);
    }
  }, []);

  // Attach stream to <video> after it mounts (fixes iOS Safari race condition)
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    stopCamera();
    runOCR(dataUrl);
  }, [stopCamera]);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setCapturedImage(dataUrl);
      runOCR(dataUrl);
    };
    reader.readAsDataURL(file);
  }, []);

  const runOCR = async (imageData: string) => {
    setOcrProcessing(true);
    setOcrMissedFields([]);
    console.log("[PJ:STEP1] OCR started");
    try {
      const token = await getToken();
      console.log("[PJ:STEP1] Auth token obtained:", token ? "yes" : "NO TOKEN");
      // Extract base64 and mime from dataUrl
      const [header, base64] = imageData.split(",");
      const mimeType = header.match(/data:(.*?);/)?.[1] || "image/jpeg";
      console.log(`[PJ:STEP1] Image: mimeType=${mimeType}, base64Length=${base64.length}`);

      const extracted = await ocrDocument(base64, mimeType, token);
      console.log("[PJ:STEP1] OCR response:", JSON.stringify(extracted));

      const missed: string[] = [];
      if (extracted.fullName) setFullName(extracted.fullName);
      else missed.push("fullName");

      if (extracted.dateOfBirth) setDateOfBirth(extracted.dateOfBirth);
      else missed.push("dateOfBirth");

      if (extracted.documentNumber) setDocumentNumber(extracted.documentNumber);
      else missed.push("documentNumber");

      if (extracted.country) {
        const match = COUNTRIES.find((c) => c.code === extracted.country);
        if (match) {
          setCountry(match.code);
          setAddress((a) => ({ ...a, country: match.code }));
        } else {
          console.warn(`[PJ:STEP1] OCR returned unknown country: ${extracted.country}`);
        }
      } else {
        missed.push("country");
      }

      console.log(`[PJ:STEP1] OCR result — filled: ${["fullName","dateOfBirth","documentNumber","country"].filter(f => !missed.includes(f)).join(", ")} | missed: ${missed.join(", ") || "none"}`);
      setOcrMissedFields(missed);
      setOcrDone(true);
    } catch (err) {
      console.error("[PJ:STEP1] OCR failed:", err);
      setOcrMissedFields(["fullName", "dateOfBirth", "documentNumber"]);
      setOcrDone(true);
    } finally {
      setOcrProcessing(false);
    }
  };

  const handleSubmit = async () => {
    console.log("[PJ:STEP1] Submit clicked", { fullName: fullName.trim(), dateOfBirth, documentNumber: documentNumber.trim(), country });
    if (!fullName.trim() || !dateOfBirth || !documentNumber.trim() || !country) {
      console.warn("[PJ:STEP1] Validation failed — missing fields");
      setError(t("onboarding.step1.fillRequired"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const token = await getToken();
      console.log("[PJ:STEP1] Submitting step 1 to API...");
      await submitOnboardingStep(1, {
        fullName: fullName.trim(),
        dateOfBirth,
        documentNumber: documentNumber.trim(),
        country,
        address,
      }, token);
      console.log("[PJ:STEP1] Step 1 completed — navigating to step 2");
      router.push("/onboarding/step/2");
    } catch (err) {
      console.error("[PJ:STEP1] Submit failed:", err);
      setError(err instanceof Error ? err.message : t("onboarding.step1.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = fullName.trim() && dateOfBirth && documentNumber.trim() && country;

  return (
    <div>
      <OnboardingProgress current={1} />

      <div className="bg-surface-card border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">{t("onboarding.step1.title")}</h2>
          <p className="text-sm text-gray-400 mt-1">{t("onboarding.step1.subtitle")}</p>
        </div>

        {/* Camera / Upload section */}
        <div className="space-y-3">
          <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">
            {t("onboarding.step1.documentPhoto")}
          </label>

          {!capturedImage && !cameraActive && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={startCamera}
                className="flex-1 py-3 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
              >
                {t("onboarding.step1.openCamera")}
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 py-3 bg-surface-hover text-gray-300 text-sm font-medium rounded-lg hover:bg-surface-border transition-colors"
              >
                {t("onboarding.step1.uploadFile")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {cameraError && (
            <div className="rounded-lg bg-pending/10 border border-pending/20 px-4 py-3 text-sm text-pending">
              {t("onboarding.step1.cameraUnavailable")}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 underline"
              >
                {t("onboarding.step1.uploadInstead")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          )}

          {cameraActive && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border-2 border-dashed border-brand-600/50 rounded-lg m-4 pointer-events-none" />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={capturePhoto}
                  className="flex-1 py-3 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors"
                >
                  {t("onboarding.step1.capture")}
                </button>
                <button
                  onClick={stopCamera}
                  className="px-4 py-3 text-sm text-gray-400 hover:text-white transition-colors"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {capturedImage && (
            <div className="space-y-3">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <img src={capturedImage} alt="Document" className="w-full rounded-lg" />
                {ocrProcessing && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="text-center">
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent mx-auto mb-2" />
                      <p className="text-sm text-white">{t("onboarding.step1.ocrProcessing")}</p>
                    </div>
                  </div>
                )}
                {ocrDone && (
                  <div className="absolute top-2 right-2 bg-approved/90 text-white text-xs px-2 py-1 rounded">
                    {t("onboarding.step1.ocrDone")}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setCapturedImage(null);
                  setOcrDone(false);
                }}
                className="text-xs text-gray-400 hover:text-white transition-colors"
              >
                {t("onboarding.step1.retakePhoto")}
              </button>
            </div>
          )}
        </div>

        {/* OCR missed fields warning */}
        {ocrDone && ocrMissedFields.length > 0 && (
          <div className="rounded-lg bg-pending/10 border border-pending/20 px-4 py-3 text-xs text-pending">
            {t("onboarding.step1.ocrMissedFields")}
          </div>
        )}

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step1.fullName")} *</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("onboarding.step1.fullNamePlaceholder")}
              className={`w-full bg-surface border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 ${
                ocrMissedFields.includes("fullName") ? "border-pending" : "border-surface-border"
              }`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step1.dateOfBirth")} *</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className={`w-full bg-surface border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 ${
                  ocrMissedFields.includes("dateOfBirth") ? "border-pending" : "border-surface-border"
                }`}
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step1.documentNumber")} *</label>
              <input
                type="text"
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value)}
                placeholder={t("onboarding.step1.documentPlaceholder")}
                className={`w-full bg-surface border rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500 ${
                  ocrMissedFields.includes("documentNumber") ? "border-pending" : "border-surface-border"
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">{t("onboarding.step1.country")} *</label>
            <select
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setAddress((a) => ({ ...a, country: e.target.value }));
              }}
              className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Address (optional, collapsible) */}
          <details className="group">
            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 transition-colors">
              {t("onboarding.step1.addressOptional")}
            </summary>
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">{t("onboarding.step1.street")}</label>
                  <input
                    type="text"
                    value={address.street}
                    onChange={(e) => setAddress((a) => ({ ...a, street: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("onboarding.step1.number")}</label>
                  <input
                    type="text"
                    value={address.number}
                    onChange={(e) => setAddress((a) => ({ ...a, number: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("onboarding.step1.city")}</label>
                  <input
                    type="text"
                    value={address.city}
                    onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("onboarding.step1.state")}</label>
                  <input
                    type="text"
                    value={address.state}
                    onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{t("onboarding.step1.zip")}</label>
                  <input
                    type="text"
                    value={address.zip}
                    onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                    className="w-full bg-surface border border-surface-border rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>
            </div>
          </details>
        </div>

        {error && (
          <div className="rounded-lg bg-blocked/10 border border-blocked/20 px-4 py-2 text-sm text-blocked">
            {error}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-8 py-2.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-500 transition-colors disabled:opacity-50"
          >
            {submitting ? t("common.loading") : t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
