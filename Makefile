.PHONY: build serve clean find-video-only

build:
	hugo --minify

dev:
	hugo server -D --buildFuture

clean:
	rm -rf public/

find-video-only:
	bun scripts/find-video-only-articles.ts
