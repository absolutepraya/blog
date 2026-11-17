{{- /* Markdown twin of the home page: site summary plus a link to every public post. */ -}}
# {{ .Site.Title }}

> {{ .Site.Params.description }}

Canonical URL: {{ .Permalink }}

## Posts

{{ $pages := where .Site.RegularPages "Type" "in" .Site.Params.mainSections -}}
{{ range (where $pages "Params.hidden" "ne" true).ByDate.Reverse -}}
- [{{ .Title }}]({{ .Permalink }}) ({{ .Date.Format "2006-01-02" }}){{ with .Description }}: {{ . }}{{ end }}
{{ end }}
## More

- [About]({{ "/about/" | absURL }})
- [Portfolio](https://abhipraya.dev)
- [GitHub](https://github.com/absolutepraya)
- [LinkedIn](https://www.linkedin.com/in/absolutepraya/)
