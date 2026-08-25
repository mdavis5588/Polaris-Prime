from django.db import models


class Entry(models.Model):
    class Kind(models.TextChoices):
        SERVICE = "service", "Service"
        API = "api", "API"
        TEMPLATE = "template", "Template"
        RESOURCE = "resource", "Resource"

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=20, choices=Kind.choices, default=Kind.SERVICE)
    description = models.TextField(blank=True)
    owner = models.CharField(max_length=200, blank=True)
    link = models.URLField(blank=True, help_text="Where to actually use/request this, if applicable")
    tags = models.CharField(max_length=300, blank=True, help_text="Comma-separated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "entries"

    def __str__(self):
        return self.name

    def tag_list(self):
        return [t.strip() for t in self.tags.split(",") if t.strip()]
