# 🚀 Automated Career Assistant

An AI-powered career assistant that analyzes job descriptions and resumes to identify skill gaps and generate tailored resumes and cover letters using Google Gemini AI.

![Tech Stack](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=for-the-badge&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.8+-3776AB?style=for-the-badge&logo=python)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript)
![Google Gemini](https://img.shields.io/badge/Google_Gemini-AI-4285F4?style=for-the-badge&logo=google)

## ✨ Features

- **📄 PDF Parsing**: Extract text from resume and job description PDFs
- **🔍 Skill Gap Analysis**: AI-powered comparison of your skills vs. job requirements
- **📊 Visual Match Percentage**: See how well you match the job posting
- **✍️ Tailored Resume Generation**: Create ATS-friendly resumes optimized for specific jobs
- **💌 Cover Letter Generation**: Generate compelling, personalized cover letters
- **📥 Multiple Export Formats**: Download documents in DOCX or PDF format
- **🎨 Modern UI**: Beautiful, responsive interface built with Next.js and Tailwind CSS

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **React Hooks** - Modern state management

### Backend
- **FastAPI** - Modern, fast Python web framework
- **Google Gemini AI** - Advanced language model for analysis and generation
- **pypdf** - PDF text extraction
- **python-docx** - DOCX file generation
- **ReportLab** - PDF file generation

## 📋 Prerequisites

- **Node.js** 20.9.0 or higher (for Next.js)
- **Python** 3.8 or higher
- **Google Gemini API Key** - [Get one here](https://makersuite.google.com/app/apikey)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd agentic
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create a virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install
```

### 4. Environment Configuration

Create a `.env` file in the root directory:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` and add your Google Gemini API key:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

> **Get your Gemini API Key**: Visit [Google AI Studio](https://makersuite.google.com/app/apikey) to generate a free API key.

## 🎯 Running the Application

### Start the Backend Server

```bash
# From the backend directory
cd backend
python main.py
```

The backend API will run at `http://localhost:8000`

### Start the Frontend Development Server

```bash
# From the frontend directory (in a new terminal)
cd frontend
npm run dev
```

The frontend will run at `http://localhost:3000`

## 📖 Usage

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Upload Files**:
   - Drag and drop or click to upload your resume (PDF format)
   - Drag and drop or click to upload the job description (PDF format)

3. **Analyze**:
   - Click "Analyze with AI" button
   - Wait for the AI to process your documents

4. **Review Results**:
   - View your match percentage
   - See matching, partial, and missing skills
   - Review key responsibilities and your experience

5. **Generate Documents**:
   - Click "DOCX" or "PDF" under "Tailored Resume" to generate an optimized resume
   - Click "DOCX" or "PDF" under "Cover Letter" to generate a personalized cover letter
   - Documents will be automatically downloaded

## 📁 Project Structure

```
agentic/
├── backend/
│   ├── main.py                 # FastAPI application entry point
│   ├── requirements.txt        # Python dependencies
│   ├── models/
│   │   └── schemas.py         # Pydantic models
│   ├── services/
│   │   ├── pdf_parser.py      # PDF text extraction
│   │   ├── gemini_service.py  # Google Gemini AI integration
│   │   ├── skill_analyzer.py  # Skill gap analysis logic
│   │   └── document_generator.py # Document generation (DOCX/PDF)
│   └── utils/
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx           # Main application page
│   │   ├── layout.tsx         # Root layout
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── FileUpload.tsx     # File upload component
│   │   ├── AnalysisResults.tsx # Results display component
│   │   └── DocumentGeneration.tsx # Document generation component
│   ├── package.json
│   └── tsconfig.json
│
├── uploads/                    # Temporary PDF storage (created automatically)
├── generated/                  # Generated documents storage (created automatically)
├── .env.example               # Environment variables template
└── README.md                  # This file
```

## 🔌 API Endpoints

### Backend API (http://localhost:8000)

- `GET /` - API status
- `GET /api/health` - Health check
- `POST /api/upload-and-analyze` - Upload files and analyze skill gaps
- `POST /api/generate-resume` - Generate tailored resume
- `POST /api/generate-cover-letter` - Generate cover letter

### API Documentation

Once the backend is running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 🎨 Features in Detail

### Skill Gap Analysis
- Identifies exact matching skills between resume and job description
- Finds partial matches (related skills)
- Lists missing skills you should consider adding
- Calculates overall match percentage

### Document Generation
- **Tailored Resumes**: Reorganizes and emphasizes relevant experience
- **ATS Optimization**: Uses keywords from job description naturally
- **Professional Formatting**: Clean, readable structure
- **Cover Letters**: Personalized content highlighting key qualifications

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is open source and available under the MIT License.

## ⚠️ Important Notes

- Always review and customize generated documents before submission
- The AI provides a strong starting point, but personal touches make the difference
- Keep your Gemini API key secure and never commit it to version control
- PDF text extraction works best with text-based PDFs (not scanned images)

## 🐛 Troubleshooting

### Backend Issues

**Issue**: `GEMINI_API_KEY not found`
- **Solution**: Make sure you created a `.env` file in the root directory with your API key

**Issue**: `Module not found` errors
- **Solution**: Ensure virtual environment is activated and run `pip install -r requirements.txt`

**Issue**: Port 8000 already in use
- **Solution**: Change the port in `main.py` or kill the process using port 8000

### Frontend Issues

**Issue**: Module resolution errors
- **Solution**: Delete `node_modules` and `package-lock.json`, then run `npm install` again

**Issue**: CORS errors
- **Solution**: Ensure the backend is running and CORS settings in `main.py` allow `http://localhost:3000`

**Issue**: Node version warning
- **Solution**: Update Node.js to version 20.9.0 or higher

## 🌟 Future Enhancements

- [ ] Support for multiple file formats (Word, plain text)
- [ ] User authentication and document history
- [ ] Batch processing for multiple job applications
- [ ] LinkedIn profile integration
- [ ] Interview preparation tips based on analysis
- [ ] Export analysis reports
- [ ] Mobile app version

## 📧 Contact

For questions or support, please open an issue in the repository.

---

