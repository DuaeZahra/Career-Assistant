"use client";

import { useState } from "react";

interface DocumentGenerationProps {
  resumeFile: File | null;
  jobDescriptionFile: File | null;
  onDocumentsGenerated?: (docs: { resumePath: string; coverLetterPath: string }) => void;
}

export default function DocumentGeneration({ resumeFile, jobDescriptionFile, onDocumentsGenerated }: DocumentGenerationProps) {
  const [loadingResume, setLoadingResume] = useState(false);
  const [loadingCover, setLoadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resumePath, setResumePath] = useState("");
  const [coverPath, setCoverPath] = useState("");

  const handleGenerateResume = async (format: "docx" | "pdf") => {
    if (!resumeFile || !jobDescriptionFile) {
      setError("Missing required files");
      return;
    }

    setLoadingResume(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("job_description", jobDescriptionFile);
      formData.append("format", format);

      const response = await fetch("http://localhost:8000/api/generate-resume", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Resume generation failed");
      }

      // Backend now uses fixed filename
      const filename = `latest_resume.${format}`;
      console.log("📄 Using fixed resume filename:", filename);

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Track the backend path for email attachment
      // The backend expects paths relative to the backend directory
      const backendPath = `generated/${filename}`;
      console.log("✅ Setting resume path:", backendPath);
      
      // Update state immediately
      setResumePath(backendPath);
      
      // Notify parent component with updated paths (use callback to get latest state)
      setResumePath(prev => {
        const newResumePath = backendPath;
        console.log("📧 Notifying parent - Resume:", newResumePath, "Cover:", coverPath);
        if (onDocumentsGenerated) {
          onDocumentsGenerated({ resumePath: newResumePath, coverLetterPath: coverPath });
        }
        return newResumePath;
      });

      setSuccess(`✅ Resume: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoadingResume(false);
    }
  };

  const handleGenerateCoverLetter = async (format: "docx" | "pdf") => {
    if (!resumeFile || !jobDescriptionFile) {
      setError("Missing required files");
      return;
    }

    setLoadingCover(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("job_description", jobDescriptionFile);
      formData.append("format", format);

      const response = await fetch("http://localhost:8000/api/generate-cover-letter", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Cover letter generation failed");
      }

      // Backend now uses fixed filename
      const filename = `latest_cover_letter.${format}`;
      console.log("📄 Using fixed cover letter filename:", filename);

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Track the backend path for email attachment
      // The backend expects paths relative to the backend directory
      const backendPath = `generated/${filename}`;
      console.log("✅ Setting cover letter path:", backendPath);
      
      // Update state immediately
      setCoverPath(backendPath);
      
      // Notify parent component with updated paths (use callback to get latest state)
      setCoverPath(prev => {
        const newCoverPath = backendPath;
        console.log("📧 Notifying parent - Resume:", resumePath, "Cover:", newCoverPath);
        if (onDocumentsGenerated) {
          onDocumentsGenerated({ resumePath: resumePath, coverLetterPath: newCoverPath });
        }
        return newCoverPath;
      });

      setSuccess(`✅ Cover Letter: ${filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoadingCover(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl shadow-2xl p-8 text-white">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-3">Generate Your Documents</h2>
        <p className="text-blue-100">
          Create professionally tailored documents optimized for your target job
        </p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="bg-green-500 rounded-lg p-4 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">{success}</p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-500 rounded-lg p-4 mb-6 flex items-center">
          <svg className="w-6 h-6 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Tailored Resume Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
          <div className="flex items-start mb-4">
            <div className="bg-white/20 p-3 rounded-lg mr-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Tailored Resume</h3>
              <p className="text-blue-100 text-sm">
                AI-optimized resume highlighting your most relevant skills and experience
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-blue-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              ATS-friendly formatting
            </div>
            <div className="flex items-center text-sm text-blue-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Keywords from job description
            </div>
            <div className="flex items-center text-sm text-blue-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Professional structure
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleGenerateResume("docx")}
              disabled={loadingResume}
              className="flex-1 bg-white text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loadingResume ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  DOCX
                </>
              )}
            </button>
            <button
              onClick={() => handleGenerateResume("pdf")}
              disabled={loadingResume}
              className="flex-1 bg-white text-blue-600 px-4 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loadingResume ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  PDF
                </>
              )}
            </button>
          </div>
        </div>

        {/* Cover Letter Card */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20 hover:bg-white/15 transition-all">
          <div className="flex items-start mb-4">
            <div className="bg-white/20 p-3 rounded-lg mr-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
              </svg>
            </div>
            <div>
              <h3 className="text-xl font-bold mb-2">Cover Letter</h3>
              <p className="text-blue-100 text-sm">
                Compelling cover letter that showcases your fit for the position
              </p>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-blue-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Personalized content
            </div>
            <div className="flex items-center text-sm text-blue-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Professional tone
            </div>
            <div className="flex items-center text-sm text-blue-100">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Highlights key qualifications
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleGenerateCoverLetter("docx")}
              disabled={loadingCover}
              className="flex-1 bg-white text-indigo-600 px-4 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loadingCover ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  DOCX
                </>
              )}
            </button>
            <button
              onClick={() => handleGenerateCoverLetter("pdf")}
              disabled={loadingCover}
              className="flex-1 bg-white text-indigo-600 px-4 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loadingCover ? (
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  PDF
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Info Note */}
      <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20">
        <div className="flex items-start">
          <svg className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-100">
            <strong className="text-white">Pro Tip:</strong> Always review and customize the generated documents 
            before submitting. While our AI creates a great starting point, adding your personal touch makes the difference!
          </p>
        </div>
      </div>
    </div>
  );
}
