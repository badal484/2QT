#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wnullability-completeness"

#include <string>
#include <vector>
#include <memory>

#ifndef RN_DEBUG_STRING_CONVERTIBLE
#define RN_DEBUG_STRING_CONVERTIBLE 1
#endif

#include <react/renderer/core/Props.h>
#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/components/view/BaseViewProps.h>
#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/debug/DebugStringConvertible.h>

namespace facebook::react {

__attribute__((weak))
SharedDebugStringConvertibleList BaseViewProps::getDebugProps() const { return {}; }

__attribute__((weak))
SharedDebugStringConvertibleList YogaStylableProps::getDebugProps() const { return {}; }

__attribute__((weak))
SharedDebugStringConvertibleList LayoutableShadowNode::getDebugProps() const { return {}; }

__attribute__((weak))
SharedDebugStringConvertibleList Props::getDebugProps() const { return {}; }

__attribute__((weak))
std::string DebugStringConvertible::getDebugName() const { return ""; }

__attribute__((weak))
std::string DebugStringConvertible::getDebugValue() const { return ""; }

__attribute__((weak))
SharedDebugStringConvertibleList DebugStringConvertible::getDebugChildren() const { return {}; }

__attribute__((weak))
std::string DebugStringConvertible::getDebugDescription(DebugStringConvertibleOptions) const { return ""; }

__attribute__((weak))
std::string DebugStringConvertible::getDebugPropsDescription(DebugStringConvertibleOptions) const { return ""; }

__attribute__((weak))
std::string DebugStringConvertible::getDebugChildrenDescription(DebugStringConvertibleOptions) const { return ""; }

}

#pragma clang diagnostic pop
