# syntax=docker/dockerfile:1.7
FROM python:3.11-slim AS base

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    git \
    unzip \
    jq \
    openjdk-21-jre-headless \
    && rm -rf /var/lib/apt/lists/*

# Install Semgrep
RUN pip install semgrep

# Install Trivy
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh -o /tmp/install-trivy.sh \
    && chmod +x /tmp/install-trivy.sh \
    && /tmp/install-trivy.sh -b /usr/local/bin \
    && rm /tmp/install-trivy.sh

# Install Gitleaks
ENV GITLEAKS_VERSION=8.18.1
RUN curl -sSL https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_linux_x64.tar.gz \
    | tar -xz -C /usr/local/bin gitleaks

# Install ffuf
ENV FFUF_VERSION=2.1.0
RUN curl -sSL https://github.com/ffuf/ffuf/releases/download/v${FFUF_VERSION}/ffuf_${FFUF_VERSION}_linux_amd64.tar.gz \
    | tar -xz -C /usr/local/bin

# Install nuclei
ENV NUCLEI_VERSION=3.6.1
RUN curl -sSL https://github.com/projectdiscovery/nuclei/releases/download/v${NUCLEI_VERSION}/nuclei_${NUCLEI_VERSION}_linux_amd64.zip -o /tmp/nuclei.zip \
    && unzip -q /tmp/nuclei.zip -d /tmp/nuclei \
    && mv /tmp/nuclei/nuclei /usr/local/bin/ \
    && rm -rf /tmp/nuclei /tmp/nuclei.zip

# Install OWASP ZAP baseline
ENV ZAP_VERSION=2.17.0
RUN mkdir -p /opt/zap \
    && curl -sSL https://github.com/zaproxy/zaproxy/releases/download/v${ZAP_VERSION}/ZAP_${ZAP_VERSION}_Crossplatform.zip -o /tmp/zap.zip \
    && unzip -q /tmp/zap.zip -d /opt/zap \
    && rm /tmp/zap.zip \
    && ln -s /opt/zap/ZAP_${ZAP_VERSION}/zap-baseline.py /usr/local/bin/zap-baseline.py \
    && ln -s /opt/zap/ZAP_${ZAP_VERSION}/zap.sh /usr/local/bin/zap.sh

# Wordlists for ffuf
RUN mkdir -p /opt/wordlists \
    && curl -sSL https://raw.githubusercontent.com/v0re/dirb/master/wordlists/common.txt -o /opt/wordlists/common.txt

# Copy backend and install
WORKDIR /opt/aegisscan
COPY backend /opt/aegisscan/backend
WORKDIR /opt/aegisscan/backend
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -e .

COPY docker/entrypoint.sh /usr/local/bin/aegisscan-entrypoint.sh
RUN chmod +x /usr/local/bin/aegisscan-entrypoint.sh

ENV FFUF_WORDLIST=/opt/wordlists/common.txt \
    ZAP_BASELINE_BIN=/usr/local/bin/zap-baseline.py \
    RESULTS_DIR=/output \
    PYTHONUNBUFFERED=1

WORKDIR /workspace
ENTRYPOINT ["/usr/local/bin/aegisscan-entrypoint.sh"]
CMD ["aegisscan"]
