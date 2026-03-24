.PHONY: build serve clean find-video-only optimize-images

build:
	hugo --minify

serve:
	hugo server -D --buildFuture

clean:
	rm -rf public/

find-video-only:
	bun scripts/find-video-only-articles.ts

optimize-images:
	@find static/images -name '*.png' -o -name '*.jpg' -o -name '*.jpeg' | while read f; do \
		webp="$${f%.*}.webp"; \
		if [ ! -f "$$webp" ]; then \
			echo "Converting $$f -> $$webp"; \
			cwebp -q 80 "$$f" -o "$$webp"; \
			rm "$$f"; \
		fi; \
	done
	@echo "Done. Reminder: update .md refs from .png/.jpg to .webp"
