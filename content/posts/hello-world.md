---
title: "Hello World"
date: 2026-03-04
description: "First post on this blog — also a markdown feature test."
tags: ["meta"]
toc: true
---

This is the first post on this blog. Built with [Hugo](https://gohugo.io/) and the [Archie-Solarized](https://github.com/hcartiaux/hugo-theme-archie-solarized) theme. Everything below is a test of markdown rendering.

## Text Formatting

This is **bold text** and this is *italic text*. You can also do ***bold and italic*** together. Here's some ~~strikethrough text~~ and some `inline code`.

## Links

- External link: [Hugo Documentation](https://gohugo.io/documentation/)
- Auto-link: https://github.com/absolutepraya
- [Link with title](https://gohugo.io "Hugo's Homepage")

## Blockquotes

> This is a blockquote. It can span multiple lines and should render with a nice left border.

> Nested blockquotes:
>
> > This is a nested blockquote.
> >
> > > And this is even deeper.

## Lists

### Unordered List

- First item
- Second item
  - Nested item A
  - Nested item B
    - Even deeper
- Third item

### Ordered List

1. First step
2. Second step
   1. Sub-step A
   2. Sub-step B
3. Third step

### Task List

- [x] Set up Hugo blog
- [x] Customize the theme
- [ ] Write actual content
- [ ] Add analytics

## Code Blocks

### Python

```python
def fibonacci(n: int) -> list[int]:
    """Generate the first n Fibonacci numbers."""
    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

print(fibonacci(10))
```

### JavaScript

```js
const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};
```

### Go

```go
package main

import "fmt"

func main() {
    ch := make(chan string)
    go func() { ch <- "hello from goroutine" }()
    fmt.Println(<-ch)
}
```

### Shell

```bash
# Deploy the blog
hugo --minify && rsync -avz public/ server:/var/www/blog/
```

### YAML

```yaml
server:
  host: 0.0.0.0
  port: 8080
  tls:
    enabled: true
    cert: /etc/ssl/cert.pem
```

## Tables

| Feature       | Supported | Notes                     |
|---------------|:---------:|---------------------------|
| Bold          | Yes       | `**text**`                |
| Italic        | Yes       | `*text*`                  |
| Code blocks   | Yes       | With syntax highlighting  |
| Tables        | Yes       | With alignment            |
| Mermaid       | Yes       | Diagram support           |
| Math (KaTeX)  | Planned   | Needs `katex: true`       |

## Horizontal Rules

Content above the rule.

---

Content below the rule.

## Images

Here's the Hugo logo (external image):

![Hugo Logo](https://d33wubrfki0l68.cloudfront.net/c38c7334cc3f23585738e40ab8dce525da8196cb/1b051/images/hugo-logo-wide.svg)

## Footnotes

Hugo is one of the most popular static site generators[^1]. It's written in Go and is known for its speed[^2].

[^1]: According to various developer surveys and GitHub stars.
[^2]: Hugo can build thousands of pages in seconds.

## Mermaid Diagrams

### Flowchart

```mermaid
graph TD
    A[User Request] --> B{Authenticated?}
    B -->|Yes| C{Role Check}
    B -->|No| D[Login Page]
    D --> E[OAuth Provider]
    E -->|Success| F[Create Session]
    E -->|Fail| D
    F --> C
    C -->|Admin| G[Admin Dashboard]
    C -->|Editor| H[CMS Panel]
    C -->|Reader| I[Blog Feed]
    G --> J[Analytics]
    G --> K[User Management]
    H --> L[Draft Editor]
    H --> M[Media Library]
    I --> N[Read Post]
    N --> O{Liked it?}
    O -->|Yes| P[Share / Bookmark]
    O -->|No| Q[Back to Feed]
    Q --> I

    subgraph Auth
        D
        E
        F
    end

    subgraph Backend
        G
        J
        K
        H
        L
        M
    end
```

### Sequence Diagram

```mermaid
sequenceDiagram
    actor U as User
    participant B as Browser
    participant CDN as CDN Edge
    participant API as API Gateway
    participant Auth as Auth Service
    participant DB as Database
    participant Cache as Redis Cache

    U->>B: Navigate to blog
    B->>CDN: GET /posts/hello-world/
    CDN-->>B: Cached HTML + assets

    U->>B: Click "Post Comment"
    B->>API: POST /api/comments
    API->>Auth: Validate JWT
    Auth-->>API: Token valid (user: alice)

    API->>Cache: Check rate limit
    Cache-->>API: 3/10 requests used

    API->>DB: INSERT comment
    DB-->>API: Comment #482 created

    API->>Cache: Invalidate post cache
    API-->>B: 201 Created

    par Async notifications
        API->>Auth: Lookup post author
        Auth-->>API: author: bob
        API->>DB: Insert notification for bob
    end

    B-->>U: Comment posted
    Note over B,Cache: Full round-trip ~120ms
```

### Git Graph

```mermaid
gitGraph
    commit id: "init repo"
    commit id: "add hugo scaffold"
    branch feature/theme
    commit id: "import archie-solarized"
    commit id: "customize colors"
    commit id: "add dark mode toggle"
    checkout main
    branch feature/content
    commit id: "hello-world draft"
    commit id: "add code samples"
    checkout feature/theme
    commit id: "mermaid support"
    checkout main
    merge feature/theme id: "merge theme" tag: "v0.2"
    checkout feature/content
    commit id: "add mermaid diagrams"
    checkout main
    merge feature/content id: "merge content"
    branch hotfix/css
    commit id: "fix mobile nav"
    checkout main
    merge hotfix/css id: "patch css" tag: "v0.2.1"
    commit id: "deploy prod"
```

### Class Diagram

```mermaid
classDiagram
    class Site {
        +String title
        +String baseURL
        +build()
        +serve()
    }
    class Config {
        +String theme
        +Map params
    }
    class Page {
        +String title
        +Date date
        +String content
        +render()
    }
    class Post {
        +Author author
        +bool draft
        +readingTime()
        +publish()
    }
    class ListPage {
        +Paginator paginator
        +paginate()
    }
    class Author {
        +String name
        +String email
        +String bio
    }
    class Tag {
        +String name
        +String slug
        +count()
    }
    class Template {
        <<interface>>
        +execute()
        +name()
    }
    class BaseTemplate {
        +String layout
    }
    class Taxonomy {
        +String singular
        +String plural
    }

    Site *-- Config
    Site *-- Page
    Page <|-- Post
    Page <|-- ListPage
    Post --> Author : writtenBy
    Post --> Tag : tagged
    Site --> Template : uses
    Template <|.. BaseTemplate
    Config *-- Taxonomy
    Taxonomy --> Tag : groups
```

### State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle

    state Idle {
        [*] --> WaitingForInput
        WaitingForInput --> Typing: keypress
        Typing --> WaitingForInput: idle 2s
    }

    Idle --> Saving: Cmd+S
    Saving --> Validating: content ready

    state Validating {
        [*] --> CheckFrontMatter
        CheckFrontMatter --> CheckContent: valid
        CheckFrontMatter --> Error: missing fields
        CheckContent --> CheckMedia: ok
        CheckMedia --> Passed: all resolved
        CheckMedia --> Error: broken links
    }

    Validating --> Building: Passed
    Validating --> Idle: Error

    state Building {
        [*] --> ParseMarkdown
        ParseMarkdown --> RenderTemplates
        RenderTemplates --> GenerateHTML
        GenerateHTML --> OptimizeAssets
        OptimizeAssets --> [*]
    }

    Building --> Preview: success
    Building --> Idle: build error

    Preview --> Publishing: approve
    Preview --> Idle: edit more

    Publishing --> Live: deployed
    Live --> Idle: new edit
    Live --> [*]: unpublish
```

### Entity Relationship Diagram

```mermaid
erDiagram
    SITE ||--o{ PAGE : contains
    SITE ||--|{ CONFIG : has
    PAGE ||--o{ REVISION : tracks
    AUTHOR ||--o{ POST : writes
    POST ||--o{ COMMENT : receives
    POST }o--o{ TAG : labeled
    POST }o--o{ CATEGORY : filed
    COMMENT ||--o{ COMMENT : repliesTo
    READER ||--o{ COMMENT : posts
    READER ||--o{ SUBSCRIPTION : subscribes
    TAG }o--|| TAXONOMY : belongsTo

    SITE {
        int id PK
        string title
        string base_url
        string language
        datetime created_at
    }
    AUTHOR {
        int id PK
        string username UK
        string email UK
        string display_name
        text bio
        string avatar_url
    }
    POST {
        int id PK
        int author_id FK
        string title
        string slug UK
        text content_md
        text content_html
        enum status "draft,review,published,archived"
        datetime published_at
        int reading_time_min
        int word_count
    }
    TAG {
        int id PK
        string name UK
        string slug UK
        int taxonomy_id FK
    }
    CATEGORY {
        int id PK
        string name
        int parent_id FK
    }
    COMMENT {
        int id PK
        int post_id FK
        int reader_id FK
        int parent_id FK "nullable"
        text body
        enum status "pending,approved,spam"
        datetime created_at
    }
    READER {
        int id PK
        string email UK
        string display_name
        datetime registered_at
    }
    REVISION {
        int id PK
        int page_id FK
        int author_id FK
        text diff
        string message
        datetime created_at
    }
    SUBSCRIPTION {
        int id PK
        int reader_id FK
        enum type "newsletter,comments,tag"
        string target
        boolean active
    }
    TAXONOMY {
        int id PK
        string singular
        string plural
    }
    CONFIG {
        int id PK
        int site_id FK
        string key
        text value
    }
```

### Pie Chart

```mermaid
pie showData
    title Blog Traffic Sources (March 2026)
    "Organic Search" : 38
    "Direct" : 22
    "Twitter / X" : 14
    "Hacker News" : 9
    "Reddit" : 7
    "RSS Feeds" : 5
    "LinkedIn" : 3
    "Other" : 2
```

### User Journey

```mermaid
journey
    title New Reader to Subscriber Journey
    section Discovery
        Google search for topic: 3: Reader
        Click blog result: 4: Reader
        Land on article page: 5: Reader
    section First Read
        Skim table of contents: 3: Reader
        Read introduction: 4: Reader
        Study code examples: 5: Reader
        View Mermaid diagrams: 5: Reader
        Scroll to conclusion: 4: Reader
    section Engagement
        Check related posts: 4: Reader
        Read a second article: 5: Reader
        Bookmark the blog: 4: Reader
    section Conversion
        Notice RSS link: 3: Reader
        Add to feed reader: 5: Reader
        Share on Twitter: 4: Reader
        Come back next week: 5: Reader
```

### Gantt Chart

```mermaid
gantt
    title Blog Development Roadmap
    dateFormat YYYY-MM-DD
    axisFormat %b %d

    section Foundation
    Hugo setup & config       :done, f1, 2026-02-25, 3d
    Theme selection           :done, f2, after f1, 1d
    Solarized customization   :done, f3, after f2, 3d
    Dark mode toggle          :done, f4, after f3, 2d

    section Content System
    Mermaid diagram support   :done, c1, after f4, 2d
    Mermaid color theming     :active, c2, after c1, 3d
    Code syntax highlighting  :c3, after c2, 2d
    KaTeX math support        :c4, after c3, 2d
    Table of contents         :c5, after c2, 1d

    section Content
    Hello World test post     :done, p1, 2026-03-04, 1d
    First real article        :p2, after c4, 3d
    Tutorial series (3 parts) :p3, after p2, 7d
    Portfolio / About page    :p4, after p2, 2d

    section Launch
    SEO metadata pass         :l1, after p3, 2d
    Performance audit         :l2, after l1, 1d
    Social preview cards      :l3, after l1, 1d
    Deploy to production      :milestone, l4, after l2, 0d
    Announce on social        :l5, after l4, 1d

    section Post-Launch
    Analytics setup           :x1, after l4, 2d
    RSS feed verification     :x2, after l4, 1d
    Collect reader feedback   :x3, after l5, 5d
    Iterate on design         :x4, after x3, 3d
```

## Definition List

Hugo
: A fast static site generator built with Go.

Markdown
: A lightweight markup language for creating formatted text.

Solarized
: A sixteen-color palette designed for use with terminal and GUI applications.

---

That covers most markdown features. More real posts coming soon.
