{{- /* Markdown twin of a page, served for "Accept: text/markdown". Password-protected posts expose no body. */ -}}
# {{ .Title }}

{{ with .Description }}> {{ . }}

{{ end -}}
{{ if not .Date.IsZero }}Published: {{ .Date.Format "2006-01-02" }}{{ with .Params.tags }} | Tags: {{ delimit . ", " }}{{ end }}

{{ end -}}
Canonical URL: {{ .Permalink }}

{{ if .Params.password_hash -}}
This page is password-protected, so its content is not available as Markdown.
{{- else -}}
{{- $base := strings.TrimSuffix "/" .Site.BaseURL -}}
{{- $body := .RawContent -}}
{{- $body = replaceRE `\{\{< figure src="([^"]*)" alt="([^"]*)" caption="([^"]*)" >\}\}` (printf "![$2](%s$1)\n\n*$3*" $base) $body -}}
{{- $body = replaceRE `\{\{< ref "([^"]*)" >\}\}` (printf "%s$1/" $base) $body -}}
{{- $body = replaceRE `\{\{[<%][^>%]*[>%]\}\}` "" $body -}}
{{ $body }}
{{- end }}
