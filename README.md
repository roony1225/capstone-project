# landmark-camera
Embedded Software Contest 2023

# Generate .pem files using openssl
- openssl genrsa -out key.pem
- openssl req -new -key key.pem -out csr.pem
- openssl x509 -req -days 9999 -in csr.pem -signkey key.pem -out cert.pem

[Ref] https://adamtheautomator.com/https-nodejs/