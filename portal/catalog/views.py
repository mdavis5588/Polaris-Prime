from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, render

from .models import Entry


@login_required
def entry_list(request):
    query = request.GET.get("q", "").strip()
    entries = Entry.objects.all()
    if query:
        entries = entries.filter(name__icontains=query)
    context = {"entries": entries, "query": query}
    if request.htmx:
        return render(request, "catalog/_entry_list.html", context)
    return render(request, "catalog/list.html", context)


@login_required
def entry_detail(request, pk):
    entry = get_object_or_404(Entry, pk=pk)
    return render(request, "catalog/detail.html", {"entry": entry})
