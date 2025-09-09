#!/usr/bin/env ruby

# rubocop :disable Buk/DecorateString

# Create an empty file at ~/.ssh/id_rsa with permissions 600 (read/write for the owner, no permissions for others)
`install -m 600 -D /dev/null ~/.ssh/id_rsa`

# Write the SSH key from the GitHub secrets to the id_rsa file
# Assuming SYNC_SSH is an environment variable containing the secret
ssh_key = ENV['SYNC_SSH']
`echo "#{ssh_key}" > ~/.ssh/id_rsa`

# Define the host for the SSH connection
host = 'github.com'

# Use the dig command to get the IP addresses for the host, filter out any addresses that end with a period,
# and replace the newline characters with commas to create a comma-separated list of hosts
hosts = `dig +short "#{host}" | grep -v '\\.$' | sed -z 's|\\n|,|g'`.chomp + host

# Use the ssh-keyscan command to get the public keys for the hosts and write them to the known_hosts file
`ssh-keyscan -H "#{hosts}" > ~/.ssh/known_hosts`

# rubocop :enable Buk/DecorateString
