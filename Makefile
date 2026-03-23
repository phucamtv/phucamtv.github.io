.PHONY: build serve clean

build:
	hugo --minify

serve:
	hugo server -D --buildFuture

clean:
	rm -rf public/
