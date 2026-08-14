import html
import re

import bleach
import markdown


IMAGE_TOKEN_RE = re.compile(r"\{\{image:([a-z0-9][a-z0-9_-]{1,48})\}\}")
HEADING_RE = re.compile(r"<h([2-4])>(.*?)</h\1>", re.IGNORECASE | re.DOTALL)


def referenced_image_keys(body):
    return {match.group(1) for match in IMAGE_TOKEN_RE.finditer(body or "")}


def reading_time_minutes(body):
    words = len(re.findall(r"\S+", body or ""))
    return max(1, (words + 179) // 180)


def _heading_slug(text, index):
    plain = re.sub(r"<[^>]+>", "", text)
    plain = re.sub(r"[^\w\u0600-\u06ff-]+", "-", plain, flags=re.UNICODE).strip("-").lower()
    return f"article-heading-{index}" if not plain else f"article-heading-{index}-{plain[:48]}"


def _add_heading_ids(rendered):
    index = 0

    def replace(match):
        nonlocal index
        index += 1
        level, content = match.groups()
        return f'<h{level} id="{_heading_slug(content, index)}">{content}</h{level}>'

    return HEADING_RE.sub(replace, rendered)


def _absolute_url(image, request=None):
    url = image.image.url
    return request.build_absolute_uri(url) if request else url


def render_article_body(article, request=None):
    """Render the editorial Markdown through one strict, server-side allowlist."""
    images = {item.key: item for item in article.inline_images.all()} if article.pk else {}

    def replace_token(match):
        return f"\n\nVILLAONE_IMAGE_TOKEN_{match.group(1)}\n\n"

    source = IMAGE_TOKEN_RE.sub(replace_token, article.body or "")
    rendered = markdown.markdown(source, extensions=["extra", "sane_lists"])

    for key, image in images.items():
        token = f"<p>VILLAONE_IMAGE_TOKEN_{key}</p>"
        figure = (
            f'<figure class="article-figure">'
            f'<img src="{html.escape(_absolute_url(image, request), quote=True)}" '
            f'alt="{html.escape(image.alt_text, quote=True)}" loading="lazy" '
            f'width="{image.width or ""}" height="{image.height or ""}">'
        )
        if image.caption:
            figure += f'<figcaption>{html.escape(image.caption)}</figcaption>'
        figure += "</figure>"
        rendered = rendered.replace(token, figure)

    rendered = _add_heading_ids(rendered)
    return bleach.clean(
        rendered,
        tags={
            "a", "blockquote", "br", "code", "em", "figcaption", "figure", "h2", "h3", "h4",
            "hr", "img", "li", "ol", "p", "pre", "strong", "ul",
        },
        attributes={
            "a": {"href", "title", "rel"},
            "figure": {"class"},
            "figcaption": {"class"},
            "h2": {"id"},
            "h3": {"id"},
            "h4": {"id"},
            "img": {"src", "alt", "loading", "width", "height"},
        },
        protocols={"http", "https", "mailto"},
    )
