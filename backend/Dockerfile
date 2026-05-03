FROM python:3.11-slim

WORKDIR /app

# Install system deps needed by some Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir "redis>=5.0.0" "aiosqlite>=0.20.0" "asyncpg>=0.29.0"

COPY . .

RUN mkdir -p uploads generated

EXPOSE 8000

CMD ["python", "main.py"]
