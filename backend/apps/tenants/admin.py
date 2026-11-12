"""
Django Admin configuration for EduFlow Control Plane.
Exclusively manages models in the Control Database (eduflow_control).
Provides visual tenant provisioning and institution management for platform superadmins.
"""

from django import forms
from django.contrib import admin, messages
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils.html import format_html

from apps.tenants.models import Institution, TenantRegistry, PlatformUser
from apps.tenants.provisioning import provision_new_tenant


class InstitutionCreationForm(forms.ModelForm):
    """
    Form used when adding a new educational institution through Django Admin.
    Captures provisioning parameters to automatically create database, run migrations,
    and seed the initial school administrator.
    """
    db_url = forms.CharField(
        required=False,
        label="Tenant Database URL",
        help_text="Optional. If left blank, automatically derived from the active Neon/PostgreSQL or SQLite setup.",
        widget=forms.TextInput(attrs={'style': 'width: 80%;', 'placeholder': 'postgresql://... or sqlite://...'})
    )
    admin_email = forms.EmailField(
        required=False,
        label="Initial Admin Email",
        help_text="Optional. Defaults to admin@<slug>.edu",
        widget=forms.EmailInput(attrs={'placeholder': 'admin@school.edu'})
    )
    admin_username = forms.CharField(
        required=False,
        label="Initial Admin Username",
        help_text="Optional. Defaults to admin_<slug>",
        widget=forms.TextInput(attrs={'placeholder': 'admin_school'})
    )
    admin_password = forms.CharField(
        required=False,
        label="Initial Admin Password",
        help_text="Optional. Defaults to SchoolPass123!",
        widget=forms.PasswordInput(render_value=True, attrs={'placeholder': 'Min 8 chars (default: SchoolPass123!)'})
    )
    admin_name = forms.CharField(
        required=False,
        label="Initial Admin Full Name",
        help_text="Optional. Defaults to 'School Administrator'",
        widget=forms.TextInput(attrs={'placeholder': 'Principal Name'})
    )

    class Meta:
        model = Institution
        fields = ['name', 'slug', 'status']

    def clean_slug(self):
        slug = self.cleaned_data.get('slug', '').strip().lower()
        if Institution.objects.using('default').filter(slug=slug).exists():
            raise forms.ValidationError(f"An institution with slug '{slug}' already exists in the Control Plane.")
        return slug


@admin.register(Institution)
class InstitutionAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'status', 'get_db_target', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('name', 'slug')
    readonly_fields = ('created_at', 'updated_at')

    def get_db_target(self, obj):
        reg = getattr(obj, 'tenant_registry', None)
        if reg:
            # Mask password in URL for display
            import re
            masked = re.sub(r':([^@]+)@', ':****@', reg.db_url)
            return masked
        return "—"
    get_db_target.short_description = "Database URL"

    def get_form(self, request, obj=None, **kwargs):
        if obj is None:
            # Adding new institution -> use provisioning form
            return InstitutionCreationForm
        # Editing existing institution -> standard form
        return super().get_form(request, obj, **kwargs)

    def save_model(self, request, obj, form, change):
        if not change:
            # New Institution creation: Run dynamic provisioning
            cd = form.cleaned_data
            slug = cd.get('slug')
            name = cd.get('name')
            db_url = cd.get('db_url') or None
            admin_email = cd.get('admin_email') or None
            admin_username = cd.get('admin_username') or None
            admin_password = cd.get('admin_password') or None
            admin_name = cd.get('admin_name') or None

            try:
                result = provision_new_tenant(
                    slug=slug,
                    name=name,
                    db_url=db_url,
                    admin_email=admin_email,
                    admin_password=admin_password,
                    admin_username=admin_username,
                    admin_name=admin_name,
                    verbosity=0
                )
                # Assign created institution attributes
                obj.id = result['institution'].id
                obj.slug = result['institution'].slug
                obj.name = result['institution'].name
                obj.status = result['institution'].status
                obj.external_tenant_id = result['institution'].external_tenant_id

                messages.success(
                    request,
                    format_html(
                        "<strong>Success!</strong> Tenant <strong>{}</strong> [{}] provisioned successfully.<br>"
                        "Database: <code>{}</code><br>"
                        "Initial Administrator: <strong>{}</strong> (Email: <code>{}</code>)",
                        name, slug, result['db_alias'], result['admin_username'], result['admin_email']
                    )
                )
            except Exception as e:
                messages.error(request, f"Failed to provision tenant '{name}': {e}")
                raise
        else:
            # Normal edit for existing institution
            super().save_model(request, obj, form, change)


@admin.register(TenantRegistry)
class TenantRegistryAdmin(admin.ModelAdmin):
    list_display = ('institution', 'provider', 'status', 'created_at')
    list_filter = ('provider', 'status')
    search_fields = ('institution__name', 'institution__slug', 'db_url')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(PlatformUser)
class PlatformUserAdmin(admin.ModelAdmin):
    list_display = ('email', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('email',)
    readonly_fields = ('created_at', 'updated_at')
