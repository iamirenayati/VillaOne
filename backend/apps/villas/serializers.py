import hashlib
import hmac
import math

from django.conf import settings
from rest_framework import serializers
from .models import Amenity, Availability, City, PriceOverride, Villa, VillaImage


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ("id", "name", "region")


class AmenitySerializer(serializers.ModelSerializer):
    class Meta:
        model = Amenity
        fields = ("id", "name", "icon")


class VillaImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = VillaImage
        fields = ("id", "url", "alt_text", "order")

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if instance.uploaded_image:
            request = self.context.get("request")
            data["url"] = request.build_absolute_uri(instance.uploaded_image.url) if request else instance.uploaded_image.url
        return data


class VillaListSerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    rating_average = serializers.DecimalField(max_digits=3, decimal_places=2, read_only=True, allow_null=True)
    reviews_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Villa
        fields = (
            "id", "slug", "title", "city", "setting_tags", "bedrooms", "capacity",
            "price_weekday", "price_weekend", "price_holiday", "deposit_percentage",
            "is_instant_bookable", "featured", "cover_image", "rating_average", "reviews_count",
        )

    def get_cover_image(self, obj):
        image = next(iter(obj.images.all()), None)
        if not image:
            return None
        if image.uploaded_image:
            request = self.context.get("request")
            return request.build_absolute_uri(image.uploaded_image.url) if request else image.uploaded_image.url
        return image.url or None


def public_map_point(villa):
    """Return a stable, privacy-preserving point inside the villa's map radius."""
    if villa.latitude is None or villa.longitude is None:
        return None
    digest = hmac.new(
        settings.SECRET_KEY.encode("utf-8"),
        f"villa-map:{villa.pk}:{villa.slug}".encode("utf-8"),
        hashlib.sha256,
    ).digest()
    angle = int.from_bytes(digest[:8], "big") / (2**64 - 1) * math.tau
    radius = max(100, int(villa.map_radius_meters))
    distance = radius * (0.55 + (digest[8] / 255) * 0.4)
    latitude = float(villa.latitude)
    longitude = float(villa.longitude)
    latitude += math.cos(angle) * distance / 111_320
    longitude += math.sin(angle) * distance / (111_320 * max(math.cos(math.radians(latitude)), 0.2))
    return f"{latitude:.6f}", f"{longitude:.6f}"


class VillaMapSerializer(serializers.ModelSerializer):
    city = CitySerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    map_latitude = serializers.SerializerMethodField()
    map_longitude = serializers.SerializerMethodField()

    class Meta:
        model = Villa
        fields = (
            "slug", "title", "city", "setting_tags", "capacity", "price_weekday",
            "featured", "cover_image", "map_latitude", "map_longitude", "map_radius_meters",
        )

    def get_cover_image(self, obj):
        image = next(iter(obj.images.all()), None)
        if not image:
            return None
        if image.uploaded_image:
            request = self.context.get("request")
            return request.build_absolute_uri(image.uploaded_image.url) if request else image.uploaded_image.url
        return image.url or None

    def get_map_latitude(self, obj):
        point = public_map_point(obj)
        return point[0] if point else None

    def get_map_longitude(self, obj):
        point = public_map_point(obj)
        return point[1] if point else None


class VillaDetailSerializer(VillaListSerializer):
    amenities = AmenitySerializer(many=True, read_only=True)
    images = VillaImageSerializer(many=True, read_only=True)

    class Meta(VillaListSerializer.Meta):
        fields = VillaListSerializer.Meta.fields + (
            "description", "map_radius_meters", "beds", "bathrooms", "cancellation_policy",
            "requires_id_verification", "amenities", "images",
        )


class VillaAdminUpdateSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(read_only=True)
    city = CitySerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()

    class Meta:
        model = Villa
        fields = (
            "slug", "title", "description", "city", "bedrooms", "beds", "bathrooms", "capacity",
            "price_weekday", "price_weekend", "price_holiday", "deposit_percentage",
            "is_instant_bookable", "requires_id_verification", "featured", "status", "cover_image",
            "latitude", "longitude", "map_radius_meters",
        )

    def get_cover_image(self, obj):
        image = obj.images.first()
        if not image:
            return None
        if image.uploaded_image:
            request = self.context.get("request")
            return request.build_absolute_uri(image.uploaded_image.url) if request else image.uploaded_image.url
        return image.url or None

    def validate_deposit_percentage(self, value):
        if value > 100:
            raise serializers.ValidationError("درصد بیعانه باید بین صفر تا صد باشد.")
        return value

    def validate(self, attrs):
        latitude = attrs.get("latitude", getattr(self.instance, "latitude", None))
        longitude = attrs.get("longitude", getattr(self.instance, "longitude", None))
        if (latitude is None) != (longitude is None):
            raise serializers.ValidationError("Latitude and longitude must be set or cleared together.")
        if latitude is not None and not (-90 <= latitude <= 90):
            raise serializers.ValidationError({"latitude": "Latitude must be between -90 and 90."})
        if longitude is not None and not (-180 <= longitude <= 180):
            raise serializers.ValidationError({"longitude": "Longitude must be between -180 and 180."})
        radius = attrs.get("map_radius_meters", getattr(self.instance, "map_radius_meters", 500))
        if not 100 <= radius <= 5000:
            raise serializers.ValidationError({"map_radius_meters": "Map radius must be between 100 and 5000 metres."})
        return attrs


class PriceOverrideAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceOverride
        fields = ("date", "price")


class AvailabilitySerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()

    class Meta:
        model = Availability
        fields = ("date", "status", "price")

    def get_price(self, obj):
        override = self.context.get("overrides", {}).get(obj.date)
        if override:
            return override.price
        return obj.villa.price_weekend if obj.date.weekday() in (3, 4) else obj.villa.price_weekday


class PriceOverrideSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceOverride
        fields = ("date", "price")


class PublicReviewSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    rating = serializers.IntegerField()
    title = serializers.CharField()
    comment = serializers.CharField()
    guest_name = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField()

    def get_guest_name(self, obj):
        return obj.guest.first_name or "مهمان ویلاوان"
