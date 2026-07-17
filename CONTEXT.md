# Blog

The public Hugo site at blog.abhipraya.dev and the content published through it.

## Social sharing

**Social preview card**:
A generated 1200 by 630 image declared through Open Graph and Twitter metadata, used when a public blog URL unfurls in another application.
_Avoid_: Embed image, unfurl image

**Card identity**:
The header wordmark `~/abhipraya`, placed at the top of every social preview card and styled with the blog's light Solarized palette.

**Card canvas**:
A full-bleed light Solarized background, not a white card on another color. A restrained rule or accent supports the wordmark without competing with the text.

**Card accent**:
Solarized blue (`#268bd2`), used for the card rule and section label. It matches the blog's existing established accent.

**Card footer**:
The quiet `blog.abhipraya.dev` source label at the bottom of a social preview card. It does not show a full page URL, author name, or social handle.

**Card body**:
A purely typographic presentation of the page, rather than a reused content image. It carries the page title and supporting page metadata.

**Card description**:
Supporting page text placed beneath the title. It renders for no more than three lines before clamping.

**Card section label**:
The compact page-class label shown above a card title, such as `POSTS`, `PPL`, `ABOUT`, or `TAG`. Dates and tag pills do not appear on cards.

**Card title**:
The full page title, rendered in no more than two lines. Supporting description text yields before a title is shortened.

**Custom social image**:
An optional page-level `social_image` front-matter value that replaces the generated social preview card. The generated card remains the default.

**Design reference image**:
An image collected or created while exploring the social-preview-card design. It is stored in the Nextcloud `Sharing` folder.

**Private page**:
A password-gated page under `/private/`. It has no social-preview metadata or card, so sharing its URL cannot reveal page details through an unfurl.

**Unfurl**:
The link preview that another application renders after reading a page's social metadata.
_Avoid_: Preview image
