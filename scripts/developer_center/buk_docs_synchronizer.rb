require 'pathname'
require 'fileutils'
require 'json'

# Module to synchronize Buk documentation between two repositories
module BukDocsSynchronizer

  MARKDOWN_FILE_PATTERN = ENV['SYNC_MARKDOWN_FILE_PATTERN'] || '{docs/**/*.md,README.md}'.freeze
  IMAGE_REFERENCE_REGEX   = /!\[.*?\]\((?!http)(.*?)(\s+".*?")?\)/
  TARGET_REPO             = 'buk-developer-center'.freeze
  SOURCE_REPO_PATH        = '.'.freeze
  MARKDOWN_TARGET_PATH    = ENV['SYNC_MARKDOWN_TARGET_PATH']
  TARGET_REPO_PATH        = "./#{TARGET_REPO}/RD/#{MARKDOWN_TARGET_PATH}".freeze
  JSON_FILE_PATH          = 'markdown_images_map.json'.freeze

  # Method to find markdown files in given root path
  def self.find_markdown_files(root_path, repo)
    excluded_dirs = ["buk-developer-center", "node_modules", "public", "lib"]

    if repo == 'source'
      Dir.glob("#{root_path}/#{MARKDOWN_FILE_PATTERN}").reject do |file|
        excluded_dirs.any? { |dir| file.include?(dir) }
      end
    elsif repo == 'target'
      Dir.glob("#{root_path}/#{MARKDOWN_FILE_PATTERN}")
    end
  end

  # Method to normalize a path relative to a root path
  def self.normalize_path(path, root_path)
    Pathname.new(path).relative_path_from(Pathname.new(root_path)).to_s
  end

  # Method to normalize an image path relative to a markdown file
  # Handles both repo-root–absolute (leading slash) and file-relative references.
  def self.normalize_image_path(image_path, md_file_path, root_path)
    base = image_path.start_with?('/') ? root_path : File.dirname(md_file_path)
    cleaned = Pathname.new(base)
                      .join(image_path.delete_prefix('/'))
                      .cleanpath
    normalize_path(cleaned, root_path)
  end

  # Method to extract image references from a markdown file
  def self.extract_image_references(content, file_path, root_path)
    matches = content.scan(IMAGE_REFERENCE_REGEX)

    matches.map do |match|
      normalize_image_path(match[0], file_path, root_path)
    end.uniq
  end

  # Method to create a map of markdown files and their image references
  def self.create_map(root_path, repo)
    markdown_files = find_markdown_files(root_path, repo)

    markdown_files.each_with_object({}) do |md_file, map|
      md_path  = normalize_path(md_file, root_path)
      content  = File.read(md_file)
      images   = extract_image_references(content, md_file, root_path)
      map[md_path] = images
    end
  end

  # Method to store the markdown/images map in a JSON file
  def self.write_map(markdown_images_map)
    File.write(JSON_FILE_PATH, JSON.dump(markdown_images_map))
  end

  # Load the markdown/images map from a JSON file
  def self.load_map
    JSON.parse(File.read(JSON_FILE_PATH))
  end

  # Copy files from source to target
  def self.copy_files(source_files)
    source_files.each do |source_file|
      target_file = source_file.sub(SOURCE_REPO_PATH, TARGET_REPO_PATH)
      FileUtils.mkdir_p(File.dirname(target_file))
      FileUtils.cp(source_file, target_file)
    end
  end

  # Sync markdown and images using the markdown_images_map
  def self.sync_docs(markdown_images_map)
    FileUtils.rm_rf(TARGET_REPO_PATH)
    markdown_images_map.each do |md_file, images|
      copy_files([File.join(SOURCE_REPO_PATH, md_file)])
      images.each do |img_path|
        copy_files([File.join(SOURCE_REPO_PATH, img_path)])
      end
    end
  end

  # Remove files from the target repository that are not in the markdown_images_map
  def self.cleanup_target_repo(markdown_images_map)
    target_map = create_map(TARGET_REPO_PATH, 'target')

    target_map.each do |md_file, images|
      if markdown_images_map.key?(md_file)
        images.each do |img|
          unless markdown_images_map[md_file].include?(img)
            FileUtils.rm(File.join(TARGET_REPO_PATH, img))
          end
        end
      else
        FileUtils.rm(File.join(TARGET_REPO_PATH, md_file))
      end
    end
  end
end
