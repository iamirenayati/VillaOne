from rest_framework.permissions import BasePermission


def has_role(user, roles):
    return bool(user and user.is_authenticated and (user.is_superuser or getattr(user, "role", None) in roles))


class IsContentOperationsAdmin(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, {"content_admin", "super_admin"})


class IsBookingOperationsAdmin(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, {"content_admin", "finance_admin", "super_admin"})


class IsFinanceOperationsAdmin(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, {"finance_admin", "super_admin"})
