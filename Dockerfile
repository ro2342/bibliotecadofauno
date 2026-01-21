FROM python:3.10-slim-bullseye

# Install system dependencies
# ImageMagick is required for cover processing
# GCC/G++ and headers might be required for building some python packages (like lxml or python-ldap)
RUN apt-get update && apt-get install -y --no-install-recommends \
    imagemagick \
    gcc \
    g++ \
    libldap2-dev \
    libsasl2-dev \
    libxml2-dev \
    libxslt1-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for caching
COPY requirements.txt optional-requirements.txt ./

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir -r optional-requirements.txt

# Copy the rest of the application
COPY . .

# Expose the default port
EXPOSE 8342

# Define volume points (User should mount these)
VOLUME ["/app/library", "/app/config"]

# Entrypoint
CMD ["python", "cps.py"]
