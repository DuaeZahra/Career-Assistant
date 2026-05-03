"use client";

interface AnalysisResultsProps {
  data: {
    job_analysis: {
      job_title: string;
      company_name?: string;
      required_skills: string[];
      preferred_skills: string[];
      key_responsibilities: string[];
    };
    resume_analysis: {
      candidate_name?: string;
      skills: string[];
      experience: string[];
      education: string[];
      summary?: string;
    };
    skill_gap: {
      matching_skills: string[];
      missing_skills: string[];
      partial_skills: string[];
    };
    match_percentage: number;
  };
}

export default function AnalysisResults({ data }: AnalysisResultsProps) {
  const { job_analysis, resume_analysis, skill_gap, match_percentage } = data;

  const getMatchColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600 bg-green-50 border-green-200";
    if (percentage >= 60) return "text-yellow-600 bg-yellow-50 border-yellow-200";
    return "text-red-600 bg-red-50 border-red-200";
  };

  const getMatchRing = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      {/* Match Score Card */}
      <div className="bg-white rounded-2xl shadow-lg p-8 border-2 border-gray-100">
        <div className="flex items-center justify-between flex-wrap gap-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Analysis Complete!</h2>
            <p className="text-gray-600">
              {job_analysis.company_name && <span className="font-medium">{job_analysis.company_name} - </span>}
              {job_analysis.job_title}
            </p>
            {resume_analysis.candidate_name && (
              <p className="text-gray-600">Candidate: {resume_analysis.candidate_name}</p>
            )}
          </div>
          
          <div className="text-center">
            <div className="relative inline-flex items-center justify-center">
              <svg className="w-32 h-32 transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - match_percentage / 100)}`}
                  className={`${getMatchRing(match_percentage)} transition-all duration-1000`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getMatchRing(match_percentage)}`}>
                  {match_percentage}%
                </span>
                <span className="text-xs text-gray-500">Match</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Skills Breakdown */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Matching Skills */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-green-100">
          <div className="flex items-center mb-4">
            <div className="bg-green-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Matching Skills</h3>
              <p className="text-sm text-gray-600">{skill_gap.matching_skills.length} skills</p>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {skill_gap.matching_skills.length > 0 ? (
              skill_gap.matching_skills.map((skill, index) => (
                <div key={index} className="bg-green-50 px-3 py-2 rounded-lg text-sm text-green-800 flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  {skill}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No exact matches found</p>
            )}
          </div>
        </div>

        {/* Partial Skills */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-yellow-100">
          <div className="flex items-center mb-4">
            <div className="bg-yellow-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Partial Matches</h3>
              <p className="text-sm text-gray-600">{skill_gap.partial_skills.length} skills</p>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {skill_gap.partial_skills.length > 0 ? (
              skill_gap.partial_skills.map((skill, index) => (
                <div key={index} className="bg-yellow-50 px-3 py-2 rounded-lg text-sm text-yellow-800">
                  {skill}
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No partial matches</p>
            )}
          </div>
        </div>

        {/* Missing Skills */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-100">
          <div className="flex items-center mb-4">
            <div className="bg-red-100 p-2 rounded-lg mr-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Missing Skills</h3>
              <p className="text-sm text-gray-600">{skill_gap.missing_skills.length} skills</p>
            </div>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {skill_gap.missing_skills.length > 0 ? (
              skill_gap.missing_skills.map((skill, index) => (
                <div key={index} className="bg-red-50 px-3 py-2 rounded-lg text-sm text-red-800 flex items-center">
                  <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {skill}
                </div>
              ))
            ) : (
              <p className="text-green-600 text-sm font-medium">All skills covered! 🎉</p>
            )}
          </div>
        </div>
      </div>

      {/* Job Details */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Job Requirements */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Key Responsibilities
          </h3>
          <ul className="space-y-2">
            {job_analysis.key_responsibilities.slice(0, 5).map((resp, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>{resp}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Resume Highlights */}
        <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            Your Experience
          </h3>
          <ul className="space-y-2">
            {resume_analysis.experience.slice(0, 5).map((exp, index) => (
              <li key={index} className="text-sm text-gray-700 flex items-start">
                <span className="text-purple-600 mr-2">•</span>
                <span>{exp}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
