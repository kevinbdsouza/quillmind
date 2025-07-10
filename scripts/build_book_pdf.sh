#!/bin/bash

# Build script for "The Interim" novel
# This script compiles all markdown files into a properly formatted PDF for self-publishing.

# Change to the script's directory to ensure correct file paths
cd "$(dirname "$0")"

echo "Building 'The Interim' PDF..."

# Create the formatted manuscript with all pre-content and LaTeX settings.
cat > formatted_manuscript.md << 'EOF'
---
geometry:
- paperwidth=6in
- paperheight=9in
- margin=1in
fontsize: 12pt
documentclass: book
classoption: openright
secnumdepth: 0
header-includes: |
  \usepackage{fancyhdr}
  \usepackage{tocloft}
  \usepackage{ifthen}
  \setlength{\parindent}{1.5em}
  \setlength{\parskip}{0pt}
  \tolerance=1000
  \emergencystretch=3em
  \raggedbottom
  
  \renewcommand{\contentsname}{Table of Contents}
  \renewcommand{\cfttoctitlefont}{\hfill\Large\bfseries}
  \renewcommand{\cftaftertoctitle}{\hfill\mbox{}}
  \makeatletter

  \newcommand{\MyTitle}{The Interim}
  \newcommand{\MyAuthor}{Ishan Viridian}

  \newcommand{\halftitlepage}{
    \cleardoublepage
    \thispagestyle{empty}
    \vspace*{\fill}
    \begin{center}
      {\Huge \bfseries \MyTitle\par}
    \end{center}
    \vspace*{\fill}
  }

  \renewcommand{\maketitle}{
    \cleardoublepage
    \thispagestyle{empty}
    \vspace*{\fill}
    \begin{center}
      {\Huge \bfseries \MyTitle\par}
      \vspace{2em}
      {\Large \textit{Part of the AI Futures Series}\par}
      \vspace{4em}
      {\large \MyAuthor\par}
    \end{center}
    \vspace*{\fill}
  }
  
  \newcommand{\copyrightpage}{
    \clearpage
    \thispagestyle{empty}
    \vspace*{\fill}
    \noindent Copyright © \the\year\ \MyAuthor\par
    \noindent All rights reserved.\par
    \vspace*{\fill}
  }

  \newcommand{\dedicationpage}{
    \cleardoublepage
    \thispagestyle{empty}
    \vspace*{\fill}
    \begin{center}
      {\Large\bfseries Dedication\par}
      \vspace{4em}
      \large\itshape To the human margin of error, where art, doubt, and hope reside.
    \end{center}
    \vspace*{\fill}
  }

  \let\oldchapter\chapter
  \renewcommand\chapter[1]{
    \ifthenelse{\equal{#1}{Chapter 2: The Weight of Utility}\OR\equal{#1}{Chapter 3: The Interim}}{
      \clearpage
    }{
      \cleardoublepage
    }
    \phantomsection
    \addcontentsline{toc}{chapter}{#1}
    \thispagestyle{empty}
    \vspace*{\fill}
    \begin{center}
      \ifthenelse{\equal{#1}{Prologue: The Last Democracy}}{
        {\Large \bfseries Prologue\par}
        \vspace{1em}
        {\Huge \bfseries The Last Democracy\par}
      }{
        \ifthenelse{\equal{#1}{Epilogue: The Pluralistic Dawn}}{
          {\Large \bfseries Epilogue\par}
          \vspace{1em}
          {\Huge \bfseries The Pluralistic Dawn\par}
        }{
          \ifthenelse{\equal{#1}{Chapter 1: The Decoupling}}{
            {\Large \bfseries Chapter 1\par}
            \vspace{1em}
            {\Huge \bfseries The Decoupling\par}
          }{
            \ifthenelse{\equal{#1}{Chapter 2: The Weight of Utility}}{
              {\Large \bfseries Chapter 2\par}
              \vspace{1em}
              {\Huge \bfseries The Weight of Utility\par}
            }{
              \ifthenelse{\equal{#1}{Chapter 3: The Interim}}{
                {\Large \bfseries Chapter 3\par}
                \vspace{1em}
                {\Huge \bfseries The Interim\par}
              }{
                {\Huge \bfseries #1\par}
              }
            }
          }
        }
      }
    \end{center}
    \vspace*{\fill}
  }

  \let\oldsection\section
  \renewcommand\section[1]{
    \clearpage
    \phantomsection
    \addcontentsline{toc}{section}{#1}
    \vspace{2em}
    \begin{center}
    {\Large \bfseries #1\par}
    \end{center}
    \vspace{1em}
  }

  \pagestyle{fancy}
  \fancyhf{}
  \fancyhead[LE]{\textit{\MyAuthor}}
  \fancyhead[RO]{\textit{\MyTitle}}
  \fancyfoot[C]{\thepage}

  \fancypagestyle{plain}{
    \fancyhf{}
    \fancyfoot[C]{\thepage}
  }
  
  \fancypagestyle{tocstyle}{
    \fancyhf{}
    \fancyfoot[C]{\thepage}
    \renewcommand{\headrulewidth}{0pt}
    \renewcommand{\footrulewidth}{0pt}
  }
  \makeatother
---
\frontmatter
\halftitlepage
\maketitle
\copyrightpage
\dedicationpage

\cleardoublepage
\pagestyle{empty}
\renewcommand{\headrulewidth}{0pt}
\tableofcontents
\clearpage
\pagestyle{fancy}
\renewcommand{\headrulewidth}{0.4pt}
\mainmatter
EOF

# Define an array of files to process in order.
# This makes it easier to manage the book's structure.
CHAPTER_FILES=(
    "prologue.md:Prologue: The Last Democracy"
    "chapter_1.md:Chapter 1: The Decoupling"
    "chapter_2.md:Chapter 2: The Weight of Utility"
    "chapter_3.md:Chapter 3: The Interim"
    "epilogue.md:Epilogue: The Pluralistic Dawn"
)

# Process each file.
for item in "${CHAPTER_FILES[@]}"; do
    file="${item%%:*}"
    title="${item#*:}"
    echo "Adding $title..."
    
    echo -e "\n# $title\n" >> formatted_manuscript.md
    
    grep -v '^# ' "$file" >> formatted_manuscript.md
done

# Add Author Bio at the end.
if [ -f author_bio.md ]; then
    echo "Adding Author Bio..."
    cat >> formatted_manuscript.md << 'AUTHORBIO'

\cleardoublepage
\phantomsection
\thispagestyle{empty}
\vspace{6em}
\begin{center}
{\Large \bfseries About the Author}
\end{center}
\vspace{2em}

AUTHORBIO
    grep -v '^# ' author_bio.md >> formatted_manuscript.md
    cat >> formatted_manuscript.md << 'AUTHOREND'

\vspace*{\fill}
\clearpage
\thispagestyle{empty}
AUTHOREND
fi

# Generate PDF with proper LaTeX processing.
echo "Converting to PDF..."
pandoc formatted_manuscript.md -o "The_Interim.pdf" \
    --standalone

if [ $? -eq 0 ]; then
    echo "✅ PDF successfully generated: The_Interim.pdf"
    echo "📄 File size: $(ls -lh The_Interim.pdf | awk '{print $5}')"
else
    echo "❌ Error generating PDF"
    exit 1
fi

# Clean up temporary file.
# rm -f formatted_manuscript.md

echo "🎉 Book build complete!"