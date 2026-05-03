

from typing import Dict, Any, List, Optional
import logging
from langchain.agents import AgentExecutor, create_react_agent
from langchain.tools import Tool
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.prompts import PromptTemplate
from langchain.schema import AgentAction, AgentFinish
import json

from services.pdf_parser import PDFParser
from services.skill_analyzer import SkillAnalyzer
from services.document_generator import DocumentGenerator
from services.email_service import EmailService
from services.gemini_service import GeminiService

logger = logging.getLogger(__name__)


class CareerAgentService:
    
    def __init__(
        self,
        api_key: str,
        document_generator: DocumentGenerator,
        output_dir: str = "generated"
    ):

        self.api_key = api_key
        self.pdf_parser = PDFParser()
        self.skill_analyzer = SkillAnalyzer()
        self.document_generator = document_generator
        self.gemini_service = GeminiService(api_key)
        self.output_dir = output_dir
        
        # Initialize LangChain LLM
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            google_api_key=api_key,
            temperature=0.1,
            convert_system_message_to_human=True,
            max_retries=3
        )
        
        # Create tools
        self.tools = self._create_tools()
        
        # Create agent
        self.agent_executor = self._create_agent()
        
        # Track agent actions for evaluation
        self.action_history: List[Dict[str, Any]] = []
    
    def _create_tools(self) -> List[Tool]:
        tools = [
            Tool(
                name="parse_pdf",
                func=self._parse_pdf_tool,
                description=(
                    "Extracts text content from a PDF file. "
                    "Input should be a file path to a PDF document. "
                    "Returns the extracted text content. "
                    "Use this when you need to read resume or job description PDFs."
                )
            ),
            Tool(
                name="analyze_job_description",
                func=self._analyze_job_tool,
                description=(
                    "Analyzes a job description text to extract structured information. "
                    "Input should be the job description text. "
                    "Returns: job_title, company_name, required_skills, preferred_skills, "
                    "key_responsibilities, and contact_email. "
                    "Use this to understand job requirements."
                )
            ),
            Tool(
                name="analyze_resume",
                func=self._analyze_resume_tool,
                description=(
                    "Analyzes a resume text to extract candidate information. "
                    "Input should be the resume text. "
                    "Returns: candidate_name, skills, experience, education, and summary. "
                    "Use this to understand candidate qualifications."
                )
            ),
            Tool(
                name="analyze_skill_gap",
                func=self._analyze_skill_gap_tool,
                description=(
                    "Compares candidate skills against job requirements. "
                    "Input should be JSON with 'job_skills' and 'candidate_skills' arrays. "
                    "Returns: matching_skills, missing_skills, partial_skills, and match_percentage. "
                    "Use this to identify skill gaps."
                )
            ),
            Tool(
                name="generate_tailored_resume",
                func=self._generate_resume_tool,
                description=(
                    "Generates a tailored resume optimized for a specific job. "
                    "Input should be JSON with 'resume_text', 'job_text', and 'format' (pdf/docx). "
                    "Returns the file path to the generated resume. "
                    "Use this when user wants to create a job-specific resume."
                )
            ),
            Tool(
                name="generate_cover_letter",
                func=self._generate_cover_letter_tool,
                description=(
                    "Generates a personalized cover letter for a job application. "
                    "Input should be JSON with 'resume_text', 'job_text', and 'format' (pdf/docx). "
                    "Returns the file path to the generated cover letter. "
                    "Use this when user wants to create a cover letter."
                )
            ),
            Tool(
                name="send_application_email",
                func=self._send_email_tool,
                description=(
                    "Sends a job application email with resume and cover letter attachments. "
                    "Input should be JSON with 'recipient_email', 'subject', 'body', "
                    "'resume_path', and 'cover_letter_path'. "
                    "Returns success status. Use this to submit applications via email."
                )
            ),
            Tool(
                name="validate_documents",
                func=self._validate_documents_tool,
                description=(
                    "Validates that generated documents exist and are accessible. "
                    "Input should be JSON with 'resume_path' and/or 'cover_letter_path'. "
                    "Returns validation status. Use this before sending emails."
                )
            )
        ]
        
        return tools
    
    def _create_agent(self) -> AgentExecutor:
        """Create the ReAct agent with tools"""
        
        # ReAct prompt template
        template = """You are an AI Career Assistant Agent that helps users with job applications.
You have access to tools that can parse PDFs, analyze documents, generate tailored resumes and cover letters, and send emails.

You should think step-by-step about what the user needs and use the appropriate tools to help them.

TOOLS:
{tools}

TOOL NAMES: {tool_names}

Use the following format:

Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be one of [{tool_names}]
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question

Begin!

Question: {input}
Thought: {agent_scratchpad}"""

        prompt = PromptTemplate.from_template(template)
        
        # Create agent
        agent = create_react_agent(
            llm=self.llm,
            tools=self.tools,
            prompt=prompt
        )
        
        # Create agent executor
        agent_executor = AgentExecutor(
            agent=agent,
            tools=self.tools,
            verbose=True,
            max_iterations=15,
            handle_parsing_errors=True,
            return_intermediate_steps=True
        )
        
        return agent_executor
    
    # Tool Implementation Methods
    
    def _parse_pdf_tool(self, file_path: str) -> str:
        try:
            import asyncio
            text = asyncio.run(self.pdf_parser.extract_text_from_pdf(file_path))
            self._log_action("parse_pdf", {"file_path": file_path}, {"success": True})
            return text
        except Exception as e:
            error_msg = f"Error parsing PDF: {str(e)}"
            self._log_action("parse_pdf", {"file_path": file_path}, {"success": False, "error": error_msg})
            return error_msg
    
    def _analyze_job_tool(self, job_text: str) -> str:
        try:
            import asyncio
            result = asyncio.run(self.gemini_service.analyze_job_description(job_text))
            self._log_action("analyze_job_description", {"text_length": len(job_text)}, {"success": True})
            return json.dumps(result, indent=2)
        except Exception as e:
            error_msg = f"Error analyzing job: {str(e)}"
            self._log_action("analyze_job_description", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _analyze_resume_tool(self, resume_text: str) -> str:
        try:
            import asyncio
            result = asyncio.run(self.gemini_service.analyze_resume(resume_text))
            self._log_action("analyze_resume", {"text_length": len(resume_text)}, {"success": True})
            return json.dumps(result, indent=2)
        except Exception as e:
            error_msg = f"Error analyzing resume: {str(e)}"
            self._log_action("analyze_resume", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _analyze_skill_gap_tool(self, input_json: str) -> str:
        try:
            data = json.loads(input_json)
            job_skills = data.get("job_skills", [])
            candidate_skills = data.get("candidate_skills", [])
            
            result = self.skill_analyzer.analyze_skill_gap(job_skills, candidate_skills)
            match_percentage = self.skill_analyzer.calculate_match_percentage(
                len(result["matching_skills"]),
                len(result["partial_skills"]),
                len(job_skills)
            )
            result["match_percentage"] = match_percentage
            
            self._log_action("analyze_skill_gap", {"num_job_skills": len(job_skills)}, {"success": True})
            return json.dumps(result, indent=2)
        except Exception as e:
            error_msg = f"Error analyzing skill gap: {str(e)}"
            self._log_action("analyze_skill_gap", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _generate_resume_tool(self, input_json: str) -> str:
        try:
            import asyncio
            import uuid
            
            data = json.loads(input_json)
            resume_text = data.get("resume_text", "")
            job_text = data.get("job_text", "")
            format_type = data.get("format", "pdf")
            
            # Generate content
            content = asyncio.run(self.gemini_service.generate_tailored_resume(resume_text, job_text))
            
            # Generate file
            filename = f"tailored_resume_{uuid.uuid4().hex[:8]}.{format_type}"
            
            if format_type == "pdf":
                file_path = self.document_generator.generate_pdf_resume(content, filename)
            else:
                file_path = self.document_generator.generate_docx_resume(content, filename)
            
            self._log_action("generate_tailored_resume", {"format": format_type}, {"success": True, "file": filename})
            return f"Resume generated successfully at: {file_path}"
            
        except Exception as e:
            error_msg = f"Error generating resume: {str(e)}"
            self._log_action("generate_tailored_resume", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _generate_cover_letter_tool(self, input_json: str) -> str:
        try:
            import asyncio
            import uuid
            
            data = json.loads(input_json)
            resume_text = data.get("resume_text", "")
            job_text = data.get("job_text", "")
            format_type = data.get("format", "pdf")
            
            # Generate content
            content = asyncio.run(self.gemini_service.generate_cover_letter(resume_text, job_text))
            
            # Generate file
            filename = f"cover_letter_{uuid.uuid4().hex[:8]}.{format_type}"
            
            if format_type == "pdf":
                file_path = self.document_generator.generate_pdf_cover_letter(content, filename)
            else:
                file_path = self.document_generator.generate_docx_cover_letter(content, filename)
            
            self._log_action("generate_cover_letter", {"format": format_type}, {"success": True, "file": filename})
            return f"Cover letter generated successfully at: {file_path}"
            
        except Exception as e:
            error_msg = f"Error generating cover letter: {str(e)}"
            self._log_action("generate_cover_letter", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _send_email_tool(self, input_json: str) -> str:
        try:
            import asyncio
            import os
            
            data = json.loads(input_json)
            
            # Get email configuration
            smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "587"))
            sender_email = os.getenv("SENDER_EMAIL")
            sender_password = os.getenv("SENDER_PASSWORD")
            
            if not sender_email or not sender_password:
                return "Error: Email not configured. Please set SENDER_EMAIL and SENDER_PASSWORD environment variables."
            
            email_service = EmailService(smtp_server, smtp_port, sender_email, sender_password)
            
            # Filter out None values from attachment paths
            attachment_paths = []
            if data.get("resume_path"):
                attachment_paths.append(data.get("resume_path"))
            if data.get("cover_letter_path"):
                attachment_paths.append(data.get("cover_letter_path"))
            
            if not attachment_paths:
                return "Error: No attachment paths provided. Please specify resume_path and/or cover_letter_path."
            
            success = asyncio.run(email_service.send_application_email(
                recipient_email=data["recipient_email"],
                subject=data["subject"],
                body=data["body"],
                attachment_paths=attachment_paths,
                candidate_name=data.get("candidate_name")
            ))
            
            self._log_action("send_application_email", {"recipient": data["recipient_email"]}, {"success": success})
            
            if success:
                return "Email sent successfully!"
            else:
                return "Failed to send email."
                
        except Exception as e:
            error_msg = f"Error sending email: {str(e)}"
            self._log_action("send_application_email", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _validate_documents_tool(self, input_json: str) -> str:
        try:
            import os
            
            data = json.loads(input_json)
            resume_path = data.get("resume_path")
            cover_letter_path = data.get("cover_letter_path")
            
            results = {}
            
            if resume_path:
                results["resume_exists"] = os.path.exists(resume_path)
                if results["resume_exists"]:
                    results["resume_size"] = os.path.getsize(resume_path)
            
            if cover_letter_path:
                results["cover_letter_exists"] = os.path.exists(cover_letter_path)
                if results["cover_letter_exists"]:
                    results["cover_letter_size"] = os.path.getsize(cover_letter_path)
            
            self._log_action("validate_documents", data, {"success": True})
            return json.dumps(results, indent=2)
            
        except Exception as e:
            error_msg = f"Error validating documents: {str(e)}"
            self._log_action("validate_documents", {}, {"success": False, "error": error_msg})
            return error_msg
    
    def _log_action(self, action_name: str, inputs: Dict[str, Any], outputs: Dict[str, Any]):
        self.action_history.append({
            "action": action_name,
            "inputs": inputs,
            "outputs": outputs,
            "timestamp": __import__('datetime').datetime.now().isoformat()
        })
    
    async def run(self, user_request: str) -> Dict[str, Any]:
        try:
            # Clear action history for new run
            self.action_history = []
            
            # Run agent
            result = self.agent_executor.invoke({"input": user_request})
            
            return {
                "success": True,
                "output": result.get("output", ""),
                "intermediate_steps": result.get("intermediate_steps", []),
                "action_history": self.action_history
            }
            
        except Exception as e:
            logger.error(f"Agent execution error: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "action_history": self.action_history
            }
    
    def get_metrics(self) -> Dict[str, Any]:
        if not self.action_history:
            return {"message": "No actions recorded yet"}
        
        total_actions = len(self.action_history)
        successful_actions = sum(1 for action in self.action_history if action["outputs"].get("success", False))
        failed_actions = total_actions - successful_actions
        
        action_types = {}
        for action in self.action_history:
            action_name = action["action"]
            action_types[action_name] = action_types.get(action_name, 0) + 1
        
        return {
            "total_actions": total_actions,
            "successful_actions": successful_actions,
            "failed_actions": failed_actions,
            "success_rate": (successful_actions / total_actions * 100) if total_actions > 0 else 0,
            "action_breakdown": action_types,
            "action_history": self.action_history
        }
