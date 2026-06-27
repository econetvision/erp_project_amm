FROM python:3.11-slim-bookworm

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

RUN adduser --disabled-password --gecos "" gwuser && chown -R gwuser:gwuser /app
USER gwuser

EXPOSE 5023

CMD ["python", "server.py"]
