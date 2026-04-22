#!/bin/bash
echo ""
echo "=== Push to GitHub ==="
echo "Paste your GitHub Personal Access Token when prompted."
echo "(Get one at: github.com > Settings > Developer settings > Personal access tokens)"
echo ""
read -s -p "GitHub Token: " TOKEN
echo ""

git remote remove github 2>/dev/null
git remote add github "https://mosesmukisa1-a11y:${TOKEN}@github.com/mosesmukisa1-a11y/Afrocatsportsclub.git"
git push github main

echo ""
echo "Done! Check https://github.com/mosesmukisa1-a11y/Afrocatsportsclub"
