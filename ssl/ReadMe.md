# MAKE LOCALHOST SSH COMPLIANT

URL: https://web.dev/how-to-use-local-https/

* Open PowerShell as administrator
* Install Chocolatey (https://chocolatey.org/install):

```
	Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

* Install mkcert (https://github.com/FiloSottile/mkcert):

```
	choco install mkcert
```

* Add mkcert to your local root CAs:

```
	mkcert -install
```

* Generate a certificate for your site, signed by mkcert:

```
	mkcert localhost
```

* Copy *localhost-key.pem* and *localhost.pem* to ssl-folder.
