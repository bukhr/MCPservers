# rubocop :disable Buk/DecorateString

require_relative 'buk_docs_synchronizer'

# Get the map of markdown files and their image references
root_path = '.'
markdown_images_map = BukDocsSynchronizer.create_map(root_path, 'source')

# Use Git to check if the last commit has .md or image file changes
changed_files = `git diff HEAD~1 --name-only 'src/**/*.md' 'src/**/docs/*.md' 'src/**/docs/*.png' 'src/**/docs/*.jpg' 'src/**/docs/*.jpeg' 'src/**/docs/*.gif' 'src/**/docs/*.svg' 'src/**/docs/*.bmp' 'src/**/docs/*.tiff' 'src/**/docs/*.webp'`.split("\n")

# Check if any of the changed files are markdown files
changed_md_files = changed_files.select { |file| file.end_with?('.md') }.any?

# Check if any of the changed files are images referenced in markdown files
image_in_md = changed_files.any? do |file|
  markdown_images_map.values.flatten.include?(file)
end

if changed_md_files || image_in_md
  # Save the map to a JSON file to be used in the next steps
  BukDocsSynchronizer.write_map(markdown_images_map)
  puts "DOC_SYNC=true"
else
  puts "DOC_SYNC=false"
end

# rubocop :enable Buk/DecorateString
