# Basis resmi Apify: Node 20 + Chromium Playwright sudah terpasang
FROM apify/actor-node-playwright-chrome:20

# HANYA package.json yang disalin (bukan package-lock.json): lock file dibuat di
# Windows dan tidak bisa ditimpa npm di dalam image (EACCES /home/myuser) -> build gagal.
COPY package.json ./
RUN npm --quiet set progress=false \
 && npm install --omit=dev --no-optional --no-audit --no-fund \
 && echo "Dependensi terpasang."

# Salin kode
COPY . ./

# Apify menjalankan perintah start dari package.json
CMD npm start --silent
