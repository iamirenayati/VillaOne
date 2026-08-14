import hashlib
import math

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.villas.models import Villa


CITY_CENTRES = {
    "قائم‌شهر": (36.4630, 52.8600),
    "قائم شهر": (36.4630, 52.8600),
    "ساری": (36.5659, 53.0586),
    "سوادکوه": (36.0057, 52.9095),
    "شیرگاه": (36.2978, 52.8815),
    "چالوس": (36.6550, 51.4204),
    "نوشهر": (36.6489, 51.4960),
    "رامسر": (36.9031, 50.6583),
}
MAZANDARAN_CENTRE = (36.4200, 52.3000)


class Command(BaseCommand):
    help = "Assign stable preview coordinates to published villas that do not have coordinates."

    def add_arguments(self, parser):
        parser.add_argument(
            "--refresh-preview",
            action="store_true",
            help="Explicitly replace coordinates for every published villa with deterministic local preview points.",
        )

    def handle(self, *args, **options):
        updated = 0
        skipped_partial = 0
        refresh_preview = options["refresh_preview"]
        if refresh_preview and not settings.DEBUG:
            raise CommandError("--refresh-preview is restricted to local debug environments.")
        villas = Villa.objects.filter(status=Villa.Status.PUBLISHED).select_related("city")
        for villa in villas:
            if not refresh_preview and (villa.latitude is not None or villa.longitude is not None):
                if villa.latitude is None or villa.longitude is None:
                    skipped_partial += 1
                continue
            centre_latitude, centre_longitude = CITY_CENTRES.get(villa.city.name, MAZANDARAN_CENTRE)
            digest = hashlib.sha256(f"villaone-map:{villa.slug}".encode("utf-8")).digest()
            angle = int.from_bytes(digest[:8], "big") / (2**64 - 1) * math.tau
            # Spread local preview records enough to keep nearby villa pins usable
            # at province scale while remaining in the villa's city region.
            distance_km = 6 + (digest[8] / 255) * 10
            latitude = centre_latitude + math.cos(angle) * distance_km / 111.32
            longitude = centre_longitude + math.sin(angle) * distance_km / (111.32 * math.cos(math.radians(centre_latitude)))
            villa.latitude = round(latitude, 6)
            villa.longitude = round(longitude, 6)
            villa.map_radius_meters = max(villa.map_radius_meters, 750)
            villa.save(update_fields=("latitude", "longitude", "map_radius_meters", "updated_at"))
            updated += 1
            self.stdout.write(f"Assigned an approximate map point to {villa.slug}.")
        mode = "refreshed" if refresh_preview else "updated"
        self.stdout.write(self.style.SUCCESS(f"{mode.title()} {updated} published villas; skipped {skipped_partial} partial coordinate records."))
