import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const AUTO_PRINT_SCRIPT = `<script>window.onload=function(){setTimeout(function(){window.print();},500);};<\/script>`;

export function openHtmlAsPdf(html: string) {
  const printHtml = html.includes("</head>")
    ? html.replace("</head>", AUTO_PRINT_SCRIPT + "</head>")
    : AUTO_PRINT_SCRIPT + html;
  const win = window.open("", "_blank");
  if (win) {
    win.document.write(printHtml);
    win.document.close();
  }
}
