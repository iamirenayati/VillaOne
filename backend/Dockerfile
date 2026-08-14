FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

WORKDIR /app

COPY requirements.txt requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt

COPY . .
RUN DJANGO_SETTINGS_MODULE=config.settings_development python manage.py collectstatic --noinput

EXPOSE 8000
CMD ["sh", "./start.sh"]
