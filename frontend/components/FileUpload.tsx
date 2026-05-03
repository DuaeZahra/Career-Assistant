"use client";

import { useState, useCallback } from "react";

interface FileUploadProps {
  onAnalysisComplete: (data: any, files: { resume: File; jobDescription: File }) => void;
}

export default function FileUpload({ onAnalysisComplete }: FileUploadProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jobFile, setJobFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<"resume" | "job" | null>(null);

  const handleDrag = useCallback((e: React.DragEvent, type: "resume" | "job") => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(type);
    } else if (e.type === "dragleave") {
      setDragActive(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, type: "resume" | "job") => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(null);

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === "application/pdf") {
        if (type === "resume") {
          setResumeFile(file);
        } else {
          setJobFile(file);
        }
        setError(null);
      } else {
        setError("Please upload PDF files only");
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "resume" | "job") => {
    const files = e.target.files;
    if (files && files[0]) {
      const file = files[0];
      if (file.type === "application/pdf") {
        if (type === "resume") {
          setResumeFile(file);
        } else {
          setJobFile(file);
        }
        setError(null);
      } else {
        setError("Please upload PDF files only");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!resumeFile || !jobFile) {
      setError("Please upload both files");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("job_description", jobFile);

      const response = await fetch("http://localhost:8000/api/upload-and-analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Analysis failed");
      }

      const data = await response.json();
      onAnalysisComplete(data, { resume: resumeFile, jobDescription: jobFile });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h2 className="text-4xl font-bold text-gray-900 mb-4">
          Get Your Dream Job Faster
        </h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Upload your resume and job description. Our AI will analyze skill gaps and generate 
          tailored documents to boost your chances.
        </p>
      </div>

      {/* Upload Cards */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        {/* Resume Upload */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-blue-200 transition-all">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-blue-100 text-blue-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">
              1
            </span>
            Your Resume
          </h3>
          
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive === "resume"
                ? "border-blue-500 bg-blue-50"
                : resumeFile
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={(e) => handleDrag(e, "resume")}
            onDragLeave={(e) => handleDrag(e, "resume")}
            onDragOver={(e) => handleDrag(e, "resume")}
            onDrop={(e) => handleDrop(e, "resume")}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e, "resume")}
              className="hidden"
              id="resume-upload"
            />
            <label htmlFor="resume-upload" className="cursor-pointer">
              {resumeFile ? (
                <div className="space-y-2">
                  <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium text-gray-900">{resumeFile.name}</p>
                  <p className="text-sm text-gray-500">{(resumeFile.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium text-gray-700">Drop your resume here</p>
                  <p className="text-sm text-gray-500">or click to browse (PDF only)</p>
                </div>
              )}
            </label>
          </div>
        </div>

        {/* Job Description Upload */}
        <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100 hover:border-purple-200 transition-all">
          <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <span className="bg-purple-100 text-purple-600 w-8 h-8 rounded-full flex items-center justify-center mr-3 text-sm font-bold">
              2
            </span>
            Job Description
          </h3>
          
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              dragActive === "job"
                ? "border-purple-500 bg-purple-50"
                : jobFile
                ? "border-green-500 bg-green-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragEnter={(e) => handleDrag(e, "job")}
            onDragLeave={(e) => handleDrag(e, "job")}
            onDragOver={(e) => handleDrag(e, "job")}
            onDrop={(e) => handleDrop(e, "job")}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => handleFileChange(e, "job")}
              className="hidden"
              id="job-upload"
            />
            <label htmlFor="job-upload" className="cursor-pointer">
              {jobFile ? (
                <div className="space-y-2">
                  <svg className="w-12 h-12 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="font-medium text-gray-900">{jobFile.name}</p>
                  <p className="text-sm text-gray-500">{(jobFile.size / 1024).toFixed(2)} KB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="font-medium text-gray-700">Drop job description here</p>
                  <p className="text-sm text-gray-500">or click to browse (PDF only)</p>
                </div>
              )}
            </label>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Analyze Button */}
      <div className="text-center">
        <button
          onClick={handleAnalyze}
          disabled={!resumeFile || !jobFile || loading}
          className={`px-8 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-105 ${
            !resumeFile || !jobFile || loading
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:shadow-xl"
          }`}
        >
          {loading ? (
            <span className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Analyzing with AI...
            </span>
          ) : (
            <span className="flex items-center justify-center">
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Analyze with AI
            </span>
          )}
        </button>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-3 gap-6 mt-16">
        <div className="text-center">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Skill Gap Analysis</h3>
          <p className="text-sm text-gray-600">Identify missing skills and strengths</p>
        </div>
        
        <div className="text-center">
          <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Tailored Resume</h3>
          <p className="text-sm text-gray-600">AI-optimized for the job posting</p>
        </div>
        
        <div className="text-center">
          <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
            </svg>
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Cover Letter</h3>
          <p className="text-sm text-gray-600">Professional and personalized</p>
        </div>
      </div>
    </div>
  );
}
