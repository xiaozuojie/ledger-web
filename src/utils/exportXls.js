function xmlEscape(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export function downloadHtmlXls(rows, fileName) {
  const body = rows
    .map((row) => {
      if (!row || !row.length) return '<tr><td></td></tr>'
      return `<tr>${row.map((c) => `<td>${xmlEscape(c)}</td>`).join('')}</tr>`
    })
    .join('')
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="UTF-8"><title>${xmlEscape(fileName)}</title></head>` +
    `<body><table border="1">${body}</table></body></html>`
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName.endsWith('.xls') ? fileName : `${fileName}.xls`
  a.click()
  URL.revokeObjectURL(url)
}
