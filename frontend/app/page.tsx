"use client";

import { useState } from "react";
import FileUpload from "@/components/FileUpload";
import AnalysisResults from "@/components/AnalysisResults";
import DocumentGeneration from "@/components/DocumentGeneration";
import EmailSender from "@/components/EmailSender";
import ApplicationHistory from "@/components/ApplicationHistory";

type Tab = "assistant" | "history";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("assistant");
  const [step, setStep] = useState<"upload" | "results">("upload");
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [uploadedFiles, setUploadedFiles] = useState<{
    resume: File | null;
    jobDescription: File | null;
  }>({ resume: null, jobDescription: null });
  const [generatedDocs, setGeneratedDocs] = useState<{
    resumePath: string;
    coverLetterPath: string;
  }>({ resumePath: "", coverLetterPath: "" });

  const handleAnalysisComplete = (data: any, files: { resume: File; jobDescription: File }) => {
    setAnalysisData(data);
    setUploadedFiles(files);
    setStep("results");
  };

  const handleReset = () => {
    setStep("upload");
    setAnalysisData(null);
    setUploadedFiles({ resume: null, jobDescription: null });
    setGeneratedDocs({ resumePath: "", coverLetterPath: "" });
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "assistant", label: "Career Assistant", icon: "🎯" },
    { id: "history",   label: "History",          icon: "📋" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-2 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Automated Career Assistant</h1>
                <p className="text-sm text-gray-600">AI-powered resume tailoring &amp; cover letters</p>
              </div>
            </div>

            {activeTab === "assistant" && step === "results" && (
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors font-medium"
              >
                New Analysis
              </button>
            )}
          </div>

          {/* Tab navigation */}
          <nav className="flex space-x-1 mt-4 -mb-px">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* ── Career Assistant tab ── */}
        {activeTab === "assistant" && (
          <>
            {step === "upload" ? (
              <FileUpload onAnalysisComplete={handleAnalysisComplete} />
            ) : (
              <div className="space-y-8">
                <AnalysisResults data={analysisData} />
                <DocumentGeneration
                  resumeFile={uploadedFiles.resume}
                  jobDescriptionFile={uploadedFiles.jobDescription}
                  onDocumentsGenerated={setGeneratedDocs}
                />
                {(generatedDocs.resumePath || generatedDocs.coverLetterPath) && (
                  <EmailSender
                    contactEmail={analysisData?.job_analysis?.contact_email || null}
                    jobTitle={analysisData?.job_analysis?.job_title || ""}
                    companyName={analysisData?.job_analysis?.company_name || null}
                    candidateName={analysisData?.resume_analysis?.candidate_name || null}
                    resumePath={generatedDocs.resumePath}
                    coverLetterPath={generatedDocs.coverLetterPath}
                  />
                )}
              </div>
            )}

          </>
        )}

        {/* ── History tab ── */}
        {activeTab === "history" && <ApplicationHistory />}
      </div>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-600 text-sm">
            Powered by Google Gemini AI &nbsp;·&nbsp; Next.js &amp; FastAPI &nbsp;·&nbsp;
            PostgreSQL &nbsp;·&nbsp; Redis &nbsp;·&nbsp; Docker
          </p>
        </div>
      </footer>
    </main>
  );
}
