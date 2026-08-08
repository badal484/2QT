require 'xcodeproj'

project_path = '/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/ios/VeltoMobile.xcodeproj'
project = Xcodeproj::Project.open(project_path)

target = project.targets.find { |t| t.name == 'VeltoMobile' }

dummy_swift_path = '/Users/badal11/Desktop/VELTO_FOOD_PALACE/mobile/ios/VeltoMobile/Dummy.swift'
File.write(dummy_swift_path, "// Dummy Swift file to enable Swift compiler in Xcode\nimport Foundation\n")

group = project.main_group.find_subpath('VeltoMobile', true)

# Avoid adding duplicate references
unless group.files.any? { |file| file.path == 'Dummy.swift' }
  file_reference = group.new_reference(dummy_swift_path)
  target.source_build_phase.add_file_reference(file_reference)
end

target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION'] = '5.0'
end

project.save
puts "Added Dummy.swift to VeltoMobile target!"
