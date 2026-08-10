#pragma clang diagnostic push
#pragma clang diagnostic ignored "-Wnullability-completeness"

#include <string>
#include <vector>
#include <memory>

#ifdef REACT_NATIVE_DEBUG
#undef REACT_NATIVE_DEBUG
#endif

#ifndef REACT_NATIVE_PRODUCTION
#define REACT_NATIVE_PRODUCTION 1
#endif

#include <react/renderer/core/Sealable.h>
#include <react/renderer/core/ShadowNode.h>
#include <react/renderer/core/LayoutableShadowNode.h>
#include <react/renderer/components/view/BaseViewProps.h>
#include <react/renderer/components/view/YogaStylableProps.h>
#include <react/renderer/debug/DebugStringConvertible.h>

namespace facebook::react {

// Out-of-line Sealable implementations matching production libReact-Fabric.a binary layout
Sealable::Sealable() {}
Sealable::~Sealable() {}
void Sealable::ensureUnsealed() const {}

std::string ShadowNode::getDebugName() const { return ""; }
std::string ShadowNode::getDebugValue() const { return ""; }
SharedDebugStringConvertibleList ShadowNode::getDebugChildren() const { return {}; }

SharedDebugStringConvertibleList BaseViewProps::getDebugProps() const { return {}; }
SharedDebugStringConvertibleList YogaStylableProps::getDebugProps() const { return {}; }
SharedDebugStringConvertibleList LayoutableShadowNode::getDebugProps() const { return {}; }
SharedDebugStringConvertibleList Props::getDebugProps() const { return {}; }

SharedDebugStringConvertibleList DebugStringConvertible::getDebugProps() const { return {}; }
std::string DebugStringConvertible::getDebugName() const { return ""; }
std::string DebugStringConvertible::getDebugValue() const { return ""; }
SharedDebugStringConvertibleList DebugStringConvertible::getDebugChildren() const { return {}; }
std::string DebugStringConvertible::getDebugDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugPropsDescription(DebugStringConvertibleOptions) const { return ""; }
std::string DebugStringConvertible::getDebugChildrenDescription(DebugStringConvertibleOptions) const { return ""; }

}

#pragma clang diagnostic pop
