.PHONY: build serve clean find-video-only optimize-images

build:
	hugo --minify

dev:
	-lsof -ti:1313 | xargs kill -9 2>/dev/null
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

# --- GC translation pipeline ---
gc-scrape:
	python3 -m scripts.gc_translation.run scrape

gc-chunk:
	python3 -m scripts.gc_translation.run chunk

gc-translate:
	python3 -m scripts.gc_translation.run translate

gc-assemble:
	python3 -m scripts.gc_translation.run assemble

gc-all:
	python3 -m scripts.gc_translation.run all

gc-test:
	python3 -m pytest tests/gc_translation/ -v

.PHONY: gc-scrape gc-chunk gc-translate gc-assemble gc-all gc-test
