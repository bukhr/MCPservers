# rubocop :disable Buk/DecorateString

require_relative 'buk_docs_synchronizer'

# Load markdown to images mapping from JSON file
markdown_images_map = BukDocsSynchronizer.load_map

if ENV['SYNC_MARKDOWN_TARGET_PATH']
  # Perform synchronization using the markdown_images_map
  BukDocsSynchronizer.sync_docs(markdown_images_map)

  # Cleanup target repository using the markdown_images_map
  BukDocsSynchronizer.cleanup_target_repo(markdown_images_map)

  # Change directory to the target repository
  Dir.chdir("./#{BukDocsSynchronizer::TARGET_REPO}")

  # Set user and email
  `git config user.email "bermuditas@buk.cl"`
  `git config user.name "bermuditas"`

  # Add changes and commit
  `git add .`
  `git commit -m "sync: update documentation files"`

  # Push changes to the remote repository
  `git push`

  puts "Sincronización completa."
else
  puts "La variable de entorno SYNC_MARKDOWN_TARGET_PATH no está configurada. Saltando sincronización."
end

# rubocop :enable Buk/DecorateString
