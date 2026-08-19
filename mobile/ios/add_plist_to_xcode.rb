require 'xcodeproj'

project_path = '/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/ios/VeltoMobile.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'VeltoMobile' }

plist_path = '/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/ios/VeltoMobile/GoogleService-Info.plist'

group = project.main_group.find_subpath('VeltoMobile', true)

# Avoid adding duplicate references
unless group.files.any? { |file| file.path == 'GoogleService-Info.plist' }
  file_reference = group.new_reference(plist_path)
  target.resources_build_phase.add_file_reference(file_reference)
  puts "Added GoogleService-Info.plist to VeltoMobile resources build phase!"
else
  puts "GoogleService-Info.plist is already in project."
end

project.save
