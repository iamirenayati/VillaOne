from django import forms

from .models import Article


class ArticleAdminForm(forms.ModelForm):
    class Meta:
        model = Article
        fields = "__all__"
        widgets = {
            "excerpt": forms.Textarea(attrs={"rows": 4, "maxlength": 500}),
            "body": forms.Textarea(attrs={"rows": 26, "class": "article-markdown-editor", "dir": "auto"}),
            "cover_alt": forms.TextInput(attrs={"maxlength": 180}),
            "cta_url": forms.URLInput(attrs={"placeholder": "/villas یا /services"}),
        }
        help_texts = {
            "body": "از Markdown استفاده کنید. برای تصویر داخلی، پس از ذخیره تصویر در پایین صفحه از {{image:key}} استفاده کنید.",
            "cta_url": "فقط مسیر داخلی ویلاوان مانند /villas یا /services/chef قابل قبول است.",
        }
