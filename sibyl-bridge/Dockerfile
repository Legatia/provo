FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py sibyl_adapter.py ./

# unprivileged user, writable volume mountpoint
RUN useradd -m bridge && mkdir -p /data && chown bridge:bridge /data
USER bridge

EXPOSE 8123
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8123"]
