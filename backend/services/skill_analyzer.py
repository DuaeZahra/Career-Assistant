from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

class SkillAnalyzer:
    
    @staticmethod
    def analyze_skill_gap(
        job_skills: List[str],
        resume_skills: List[str]
    ) -> Dict[str, List[str]]:
        # Normalize skills for comparison (lowercase)
        job_skills_lower = {skill.lower().strip() for skill in job_skills}
        resume_skills_lower = {skill.lower().strip() for skill in resume_skills}
        
        # Create mapping for original case
        job_skills_map = {skill.lower().strip(): skill for skill in job_skills}
        resume_skills_map = {skill.lower().strip(): skill for skill in resume_skills}
        
        # Find exact matches
        matching = job_skills_lower.intersection(resume_skills_lower)
        matching_skills = [job_skills_map[skill] for skill in matching]
        
        # Find missing skills (in job but not in resume)
        missing = job_skills_lower - resume_skills_lower
        missing_skills = [job_skills_map[skill] for skill in missing]
        
        # Find partial matches (similar skills)
        partial_skills = []
        for job_skill in missing:
            for resume_skill in resume_skills_lower:
                if (job_skill in resume_skill or resume_skill in job_skill) and \
                   len(job_skill) > 3 and len(resume_skill) > 3:
                    partial_skills.append(f"{job_skills_map[job_skill]} (similar to {resume_skills_map[resume_skill]})")
                    break
        
        # Remove partial matches from missing skills
        partial_base_skills = [skill.split(' (similar')[0] for skill in partial_skills]
        missing_skills = [skill for skill in missing_skills if skill not in partial_base_skills]
        
        return {
            "matching_skills": matching_skills,
            "missing_skills": missing_skills,
            "partial_skills": partial_skills
        }
    
    @staticmethod
    def calculate_match_percentage(
        matching_count: int,
        partial_count: int,
        total_required: int
    ) -> float:
        if total_required == 0:
            return 0.0
        
        # Weight exact matches at 100% and partial matches at 50%
        weighted_match = matching_count + (partial_count * 0.5)
        percentage = (weighted_match / total_required) * 100
        
        return round(min(percentage, 100.0), 2)
