import google.generativeai as genai
import json
import logging
from typing import Dict, Any, Optional
import os

logger = logging.getLogger(__name__)

class GeminiService:
    
    def __init__(self, api_key: str):
       
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash-lite')
    
    async def analyze_job_description(self, job_text: str) -> Dict[str, Any]:
        
        try:
            prompt = f"""
Analyze the following job description and extract the information in JSON format.

Job Description:
{job_text}

Please provide the response in the following JSON structure:
{{
    "job_title": "extracted job title",
    "company_name": "company name if available, otherwise null",
    "contact_email": "hiring manager or recruiter email if available, otherwise null",
    "required_skills": ["skill1", "skill2", ...],
    "preferred_skills": ["skill1", "skill2", ...],
    "key_responsibilities": ["responsibility1", "responsibility2", ...]
}}

Focus on technical skills, soft skills, tools, frameworks, and technologies.
Extract any contact email addresses mentioned in the job posting.
Be specific and comprehensive. Return only valid JSON.
"""
            
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean markdown code blocks if present
            if result_text.startswith("```json"):
                result_text = result_text.replace("```json", "").replace("```", "").strip()
            elif result_text.startswith("```"):
                result_text = result_text.replace("```", "").strip()
            
            result = json.loads(result_text)
            
            # Ensure required fields have default values if None or missing
            result.setdefault('job_title', 'Not Specified')
            result.setdefault('company_name', None)
            result.setdefault('contact_email', None)
            result.setdefault('required_skills', [])
            result.setdefault('preferred_skills', [])
            result.setdefault('key_responsibilities', [])
            
            # Handle None values for required string fields
            if result['job_title'] is None:
                result['job_title'] = 'Not Specified'
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing job description: {str(e)}")
            raise
    
    async def analyze_resume(self, resume_text: str) -> Dict[str, Any]:
        
        try:
            prompt = f"""
Analyze the following resume and extract the information in JSON format.

Resume:
{resume_text}

Please provide the response in the following JSON structure:
{{
    "candidate_name": "candidate name if available, otherwise null",
    "skills": ["skill1", "skill2", ...],
    "experience": ["experience1", "experience2", ...],
    "education": ["degree1", "degree2", ...],
    "summary": "brief professional summary"
}}

Focus on technical skills, soft skills, work experience, and educational background.
Be comprehensive and specific. Return only valid JSON.
"""
            
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Clean markdown code blocks if present
            if result_text.startswith("```json"):
                result_text = result_text.replace("```json", "").replace("```", "").strip()
            elif result_text.startswith("```"):
                result_text = result_text.replace("```", "").strip()
            
            result = json.loads(result_text)
            
            # Ensure required fields have default values if None or missing
            result.setdefault('candidate_name', None)
            result.setdefault('skills', [])
            result.setdefault('experience', [])
            result.setdefault('education', [])
            result.setdefault('summary', None)
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing resume: {str(e)}")
            raise
    
    async def generate_tailored_resume(
        self,
        resume_text: str,
        job_text: str,
        candidate_name: Optional[str] = None
    ) -> str:

        try:
            prompt = f"""
Create a tailored, professional resume that highlights the candidate's relevant experience and skills for the specific job description.

Original Resume:
{resume_text}

Target Job Description:
{job_text}

CRITICAL INSTRUCTIONS:
1. Output ONLY the resume content - NO introductions, explanations, or preambles
2. Start directly with the candidate's name from the resume
3. Use ACTUAL information from the resume (real name, email, phone) - NO placeholders like [Your Name], [Your Email]
4. Use **bold** for important keywords that match the job description
5. Structure: Professional Summary, Skills, Experience, Education
6. Make it ATS-friendly with clear section headers
7. Keep content truthful - only reorganize and emphasize
8. Use markdown formatting: **bold** for emphasis, ## for section headers

Generate the resume now:
"""
            
            response = self.model.generate_content(prompt)
            content = response.text.strip()
            
            # Remove common preambles
            preambles = [
                "Here's a tailored resume",
                "Here is a tailored resume",
                "Below is a tailored resume",
                "This is a tailored resume",
                "I've created a tailored resume",
            ]
            
            for preamble in preambles:
                if content.lower().startswith(preamble.lower()):
                    # Find the first line break after preamble and remove everything before it
                    first_break = content.find('\n')
                    if first_break != -1:
                        content = content[first_break:].strip()
                    break
            
            return content
            
        except Exception as e:
            logger.error(f"Error generating tailored resume: {str(e)}")
            raise
    
    async def generate_cover_letter(
        self,
        resume_text: str,
        job_text: str,
        candidate_name: Optional[str] = None,
        company_name: Optional[str] = None,
        job_title: Optional[str] = None
    ) -> str:
        
        try:
            prompt = f"""
Write a compelling, professional cover letter based on the candidate's resume and the job description.

Resume:
{resume_text}

Job Description:
{job_text}

CRITICAL INSTRUCTIONS:
1. Output ONLY the cover letter body - NO placeholders like [Your Name], [Your Email], [Date]
2. Use ACTUAL information from the resume (real name, email, phone if mentioned)
3. Extract company name and job title from the job description
4. Start directly with the actual date (today's date)
5. Use **bold** for important keywords and skills that match the job requirements
6. Structure: Date, Greeting, Opening paragraph, 2-3 body paragraphs, Closing
7. Keep it professional, concise (3-4 paragraphs), and authentic
8. End with "Sincerely," followed by the candidate's actual name from resume

Format as a proper business letter with actual information extracted from the documents.

Generate the cover letter now:
"""
            
            response = self.model.generate_content(prompt)
            content = response.text.strip()
            
            # Remove common preambles
            preambles = [
                "Here's a cover letter",
                "Here is a cover letter",
                "Below is a cover letter",
                "This is a cover letter",
                "I've created a cover letter",
            ]
            
            for preamble in preambles:
                if content.lower().startswith(preamble.lower()):
                    # Find the first line break after preamble and remove everything before it
                    first_break = content.find('\n')
                    if first_break != -1:
                        content = content[first_break:].strip()
                    break
            
            return content
            
        except Exception as e:
            logger.error(f"Error generating cover letter: {str(e)}")
            raise
