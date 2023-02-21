set -euo pipefail

yarn run build
echo 'subtitle-renamer.mahdi.pro' > dist/CNAME
npx gh-pages -d dist
