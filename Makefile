SERVICE=browz

.PHONY: docker
docker:
	docker build . -t rcbilson/${SERVICE}
