"use client";

import { useState } from "react";

interface EmailSenderProps {
  contactEmail: string | null;
  jobTitle: string;
  companyName: string | null;
  candidateName: string | null;
  resumePath: string;
  coverLetterPath: string;
}

export default function EmailSender({
  contactEmail,
  jobTitle,
  companyName,
  candidateName,
  resumePath,
  coverLetterPath,
}: EmailSenderProps) {
  const [recipientEmail, setRecipientEmail] = useState(contactEmail || "");
  const [subject, setSubject] = useState(
    `Application for ${jobTitle}${candidateName ? ` - ${candidateName}` : ""}`
  );
  const [body, setBody] = useState(
    `Dear Hiring Manager,\n\nI am writing to express my strong interest in the ${jobTitle} position${
      companyName ? ` at ${companyName}` : ""
    }. Please find attached my resume and cover letter for your review.\n\nI look forward to the opportunity to discuss how my skills and experience align with your team's needs.\n\nBest regards,\n${
      candidateName || "[Your Name]"
    }`
  );
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      setError("Please enter a recipient email address");
      return;
    }

    if (!resumePath || !coverLetterPath) {
      setError("Please generate documents before sending email");
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("http://localhost:8000/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient_email: recipientEmail,
          subject: subject,
          body: body,
          resume_path: resumePath,
          cover_letter_path: coverLetterPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to send email");
      }

      const data = await response.json();
      setSuccess(data.message || "Email sent successfully!");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl shadow-2xl p-8 text-white">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold mb-2">📧 Send Application Email</h2>
        <p className="text-green-100">
          Send your tailored resume and cover letter directly to the hiring manager
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

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 space-y-4">
        {/* Recipient Email */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Recipient Email *
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="hiring.manager@company.com"
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
          {!contactEmail && (
            <p className="text-xs text-green-200 mt-1">
              ℹ️ No email found in job description. Please enter manually.
            </p>
          )}
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Subject *
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Application for Position"
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50"
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Email Body *
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email message..."
            rows={8}
            className="w-full px-4 py-3 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
          />
        </div>

        {/* Attachments Info */}
        <div className="bg-white/10 rounded-lg p-4">
          <p className="text-sm font-medium mb-2">📎 Attachments:</p>
          <ul className="text-sm text-green-100 space-y-1">
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {resumePath ? "Resume (attached)" : "Resume (not generated)"}
            </li>
            <li className="flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {coverLetterPath ? "Cover Letter (attached)" : "Cover Letter (not generated)"}
            </li>
          </ul>
        </div>

        {/* Send Button */}
        <button
          onClick={handleSendEmail}
          disabled={sending || !recipientEmail || !resumePath || !coverLetterPath}
          className={`w-full px-6 py-4 rounded-lg font-semibold text-lg transition-all transform hover:scale-105 flex items-center justify-center ${
            sending || !recipientEmail || !resumePath || !coverLetterPath
              ? "bg-gray-400 text-gray-200 cursor-not-allowed"
              : "bg-white text-green-600 shadow-lg hover:shadow-xl"
          }`}
        >
          {sending ? (
            <>
              <svg className="animate-spin h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Sending Email...
            </>
          ) : (
            <>
              <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Send Application Email
            </>
          )}
        </button>

        {/* Note */}
        <div className="flex items-start text-xs text-green-100 bg-white/10 rounded-lg p-3">
          <svg className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>
            Make sure your email is configured in the backend .env file. Use Gmail App Password for best results.
          </p>
        </div>
      </div>
    </div>
  );
}
