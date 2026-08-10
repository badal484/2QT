require 'xcodeproj'
project = Xcodeproj::Project.open('ios/VeltoMobile.xcodeproj')
target = project.targets.find { |t| t.name == 'VeltoMobile' }
sources_build_phase = target.source_build_phase
found = sources_build_phase.files.any? { |f| f.file_ref && f.file_ref.name == 'ReactCppFix.mm' || f.file_ref.path == 'ReactCppFix.mm' }
puts "Found in Compile Sources: #{found}"
