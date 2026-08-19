require 'xcodeproj'

project_path = '/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/ios/VeltoMobile.xcodeproj'
project = Xcodeproj::Project.open(project_path)
target = project.targets.find { |t| t.name == 'VeltoMobile' }

assets_folder_path = '/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/ios/assets'

# Check if already added
existing = target.resources_build_phase.files.any? { |f| f.file_ref && f.file_ref.path && f.file_ref.path.include?('assets') }

unless existing
  file_reference = project.main_group.new_reference(assets_folder_path)
  target.resources_build_phase.add_file_reference(file_reference)
  puts "Added assets folder reference to VeltoMobile resources build phase!"
else
  puts "assets folder is already in project resources."
end

project.save
